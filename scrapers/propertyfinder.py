"""Property Finder (propertyfinder.ae) scraper — Ajman land, rent + sale.

Strategy (from recon + live debugging): PF is a Next.js site (lighter anti-bot —
AWS WAF). Its listings are server-rendered into `__NEXT_DATA__` at
`props.pageProps.searchResult.listings`, where each entry wraps the real listing in
a `.property` object. We navigate each Ajman land search URL, parse the blob out of
the page HTML, and paginate via `?page=N`.

Scope = land plots only (the /commercial-buy|commercial-rent/.../land-for-*.html
trees are commercial land). PF gives `size` with an explicit unit, and price/offering
type as structured objects, so mapping is direct.
"""
from __future__ import annotations

import json
import logging
import re

from db.client import upsert_listings

from .base import BaseScraper
from .normalize import collapse_duplicates, normalize_listing

log = logging.getLogger("scraper.propertyfinder")

BASE = "https://www.propertyfinder.ae"

# (url path, our listing_type) — Ajman LAND only
SEARCHES = [
    ("/en/commercial-buy/ajman/land-for-sale.html", "sale"),
    ("/en/commercial-rent/ajman/land-for-rent.html", "rent"),
]


def _page_url(path: str, page: int) -> str:
    return f"{BASE}{path}" if page <= 1 else f"{BASE}{path}?page={page}"


def _extract_props(html: str) -> list:
    """Pull the .property objects out of searchResult.listings in __NEXT_DATA__."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return []
    try:
        nd = json.loads(m.group(1))
    except Exception:
        return []
    listings = (nd.get("props", {}).get("pageProps", {})
                  .get("searchResult", {}).get("listings")) or []
    return [l["property"] for l in listings
            if isinstance(l, dict) and isinstance(l.get("property"), dict)]


def _subtype(offering: str) -> str:
    o = (offering or "").lower()
    if "industrial" in o:
        return "industrial_land"
    if "residential" in o:
        return "residential_land"
    if "commercial" in o:
        return "commercial_land"
    return "land"


class PropertyFinderScraper(BaseScraper):
    source = "propertyfinder"

    def _map(self, p: dict, listing_type: str) -> dict:
        price = p.get("price") or {}
        size = p.get("size") or {}
        size_val = size.get("value")
        size_str = f"{size_val} {size.get('unit', 'sqft')}" if size_val else None
        loc = p.get("location") or {}
        url = p.get("share_url") or (BASE + (p.get("details_path") or ""))
        return {
            "source_url": (url or "").split("?")[0] or None,
            "title": p.get("title"),
            "price": None if price.get("is_hidden") else price.get("value"),
            "price_period": "total" if listing_type == "sale" else "year",
            "size": size_str,                       # parse_size handles the unit
            "area_raw": loc.get("full_name"),
            "listing_type": listing_type,
            "category": "land",
            "subtype": _subtype(p.get("offering_type")),
            "listed_date": (p.get("listed_date") or "")[:10] or None,
            "external_id": p.get("id") or p.get("listing_id"),
        }

    def _scrape_search(self, path: str, listing_type: str) -> list[dict]:
        page = self.new_page()
        all_props: dict = {}
        try:
            for pg in range(1, self.max_pages + 1):
                if not self.goto(page, _page_url(path, pg)):
                    break
                page.wait_for_timeout(1000)
                props = _extract_props(page.content())
                if not props:
                    log.warning("  %s page %d: 0 listings (stopping)", path, pg)
                    break
                fresh = 0
                for p in props:
                    key = str(p.get("id") or p.get("listing_id") or "")
                    if key and key not in all_props:
                        all_props[key] = p
                        fresh += 1
                log.info("  %s page %d: %d listings (+%d new, total %d)", path, pg, len(props), fresh, len(all_props))
                if fresh == 0:
                    break
        finally:
            try:
                page.close()
            except Exception:
                pass
        return [self._map(p, listing_type) for p in all_props.values()]

    def run(self, dry_run: bool = False) -> list[dict]:
        rows: list[dict] = []
        with self:
            for path, listing_type in SEARCHES:
                log.info("=== propertyfinder %s (%s) ===", path, listing_type)
                try:
                    raws = self._scrape_search(path, listing_type)
                except Exception as exc:  # noqa: BLE001
                    log.exception("slice %s failed: %s", path, exc)
                    continue
                rows.extend(normalize_listing(r, self.source) for r in raws)

        uniq = {r["source_url"]: r for r in rows if r.get("source_url")}
        rows = list(uniq.values())
        deduped = collapse_duplicates(rows)
        log.info("propertyfinder: %d after url-dedup, %d after content-dedup (-%d)",
                 len(rows), len(deduped), len(rows) - len(deduped))
        rows = deduped
        if rows:
            s = rows[0]
            log.info("SAMPLE — title=%r price=%s size_sqft=%s ppsf=%s subtype=%s area_key=%s area_raw=%r",
                     (s.get("title") or "")[:50], s.get("price"), s.get("size_sqft"),
                     s.get("price_per_sqft"), s.get("subtype"), s.get("area_key"), s.get("area_raw"))
        if dry_run:
            log.info("dry-run: NOT writing to DB.")
        elif rows:
            upsert_listings(rows)
        return rows
