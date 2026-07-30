"""Dubizzle (ae.dubizzle.com) scraper — Ajman commercial units + land, rent + sale.

Strategy (from recon + live debugging): Dubizzle is a Next.js SPA behind DataDome.
Its real listings are NOT in the Algolia feed (that only serves "new project" promos)
— they are server-rendered into the page's `__NEXT_DATA__`, inside a Redux action of
type `listings/fetchListingDataForQuery/fulfilled` at `payload.hits`. We navigate each
Ajman search URL, parse that blob out of the HTML (DataDome doesn't block the SSR page
itself), and paginate via `?page=N`.

We scrape only the COMMERCIAL tree (offices/shops/warehouses/showrooms/staff-accomm +
commercial-plot/industrial-land/mixed-use-land) — this covers commercial units AND
commercial/industrial land, without pulling residential land. Per-hit category/subtype
is derived from `categories.slug`.

Dubizzle reports `size` in SQFT already (no conversion). Bilingual fields use `.en`.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from db.client import upsert_listings

from .base import BaseScraper
from .normalize import collapse_duplicates, normalize_listing

log = logging.getLogger("scraper.dubizzle")

BASE = "https://ajman.dubizzle.com"

# Dubizzle category slug (most specific first in categories.slug) -> (our category, subtype)
SUBTYPE_MAP = {
    "office": ("commercial_unit", "office"),
    "shop": ("commercial_unit", "shop"),
    "warehouse": ("commercial_unit", "warehouse"),
    "showroom": ("commercial_unit", "showroom"),
    "staff-accomm": ("commercial_unit", "labour_camp"),
    "commercial-building": ("commercial_unit", "commercial_building"),
    "commercial-villa": ("commercial_unit", "commercial_villa"),
    "commercial-floor": ("commercial_unit", "commercial_floor"),
    "bulk-unit": ("commercial_unit", "bulk_unit"),
    "factory": ("commercial_unit", "factory"),
    "commercial-plot": ("land", "commercial_land"),
    "industrial-land": ("land", "industrial_land"),
    "mixed-use-land": ("land", "mixed_use_land"),
}

# (url path, our listing_type) — land + ALL commercial units.
# The /commercial/ parent pages list every commercial subtype (offices, shops,
# warehouses, showrooms, buildings, villas, floors, factories, bulk units, labour
# accommodation) AND commercial/industrial plots; per-hit categories.slug maps each
# via _category(). Residential land sale lives in the main /property-for-sale/land/ tree.
SEARCHES = [
    ("/en/property-for-sale/land/", "sale"),
    ("/en/property-for-rent/commercial/", "rent"),
    ("/en/property-for-sale/commercial/", "sale"),
]

_LISTINGS_ACTION = "fetchListingDataForQuery/fulfilled"


def _en(value):
    """Bilingual {en, ar} -> en; passthrough otherwise."""
    return value.get("en") if isinstance(value, dict) else value


def _page_url(path: str, page: int, area_slug: str | None = None) -> str:
    p = f"{path}{area_slug}/" if area_slug else path
    return f"{BASE}{p}" if page <= 1 else f"{BASE}{p}?page={page}"


def _area_slug(name_en: str) -> str:
    """'Al Rumailah 3' -> 'al-rumailah-3' (Dubizzle's URL segment convention)."""
    return re.sub(r"[^a-z0-9]+", "-", name_en.strip().lower()).strip("-")


def _to_date(value):
    if not value:
        return None
    try:
        if isinstance(value, (int, float)) or str(value).isdigit():
            return datetime.fromtimestamp(int(value), tz=timezone.utc).date().isoformat()
        return str(value)[:10]
    except Exception:
        return None


def _extract_hits(html: str) -> list:
    """Pull payload.hits from the listings Redux action embedded in __NEXT_DATA__."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return []
    try:
        nd = json.loads(m.group(1))
    except Exception:
        return []
    pp = nd.get("props", {}).get("pageProps", {})
    acts = (pp.get("reduxWrapperActionsGIPP") or []) + (pp.get("reduxWrapperActionsGIAP") or [])
    for a in acts:
        if isinstance(a, dict) and str(a.get("type", "")).endswith(_LISTINGS_ACTION):
            hits = (a.get("payload") or {}).get("hits")
            if isinstance(hits, list):
                return hits
    return []


def _category(slugs) -> tuple:
    for s in slugs or []:
        if s in SUBTYPE_MAP:
            return SUBTYPE_MAP[s]
    if "land" in (slugs or []):
        return ("land", "land")
    if "commercial" in (slugs or []):
        return ("commercial_unit", "other_commercial")
    return (None, None)


def _area_raw(hit: dict) -> str:
    nb = (hit.get("neighborhoods") or {}).get("name")
    names = nb.get("en") if isinstance(nb, dict) else None
    parts = list(names or [])
    city = _en((hit.get("city") or {}).get("name")) if isinstance(hit.get("city"), dict) else None
    if city:
        parts.append(city)
    return ", ".join(p for p in parts if p)


class DubizzleScraper(BaseScraper):
    source = "dubizzle"

    def _map(self, hit: dict, listing_type: str) -> dict:
        category, subtype = _category((hit.get("categories") or {}).get("slug"))
        freq = (_en(hit.get("payment_frequency")) or "").lower()
        period = "total" if listing_type == "sale" else \
            ("month" if "month" in freq else "year")
        url = (_en(hit.get("absolute_url")) or "").split("?")[0]
        ext = hit.get("id") or hit.get("external_id") or hit.get("uuid")
        return {
            "source_url": url or None,
            "title": _en(hit.get("name")),
            "price": None if hit.get("is_price_hidden") else hit.get("price"),
            "price_period": period,
            "size": hit.get("size") or hit.get("plot_area"),   # Dubizzle reports sqft
            "area_raw": _area_raw(hit),
            "listing_type": listing_type,
            "category": category,
            "subtype": subtype,
            "listed_date": _to_date(hit.get("added")),
            "external_id": ext,
        }

    def _scrape_search(self, path: str, listing_type: str, area_slug: str | None = None) -> list[dict]:
        page = self.new_page()
        all_hits: dict = {}
        try:
            for pg in range(1, self.max_pages + 1):
                if not self.goto(page, _page_url(path, pg, area_slug)):
                    break
                page.wait_for_timeout(1200)
                hits = _extract_hits(page.content())
                if not hits and self.page_has_captcha(page, data_marker="__NEXT_DATA__"):
                    # DataDome inline challenge: pause for a human solve, then retry this page
                    if not self.wait_for_captcha(page, data_marker="__NEXT_DATA__"):
                        break
                    if not self.goto(page, _page_url(path, pg, area_slug)):
                        break
                    page.wait_for_timeout(1200)
                    hits = _extract_hits(page.content())
                if not hits:
                    log.warning("  %s page %d: 0 hits (stopping)", path, pg)
                    break
                fresh = 0
                for h in hits:
                    key = str(h.get("id") or h.get("uuid") or h.get("objectID") or "")
                    if key and key not in all_hits:
                        all_hits[key] = h
                        fresh += 1
                log.info("  %s page %d: %d hits (+%d new, total %d)", path, pg, len(hits), fresh, len(all_hits))
                if fresh == 0:
                    break
        finally:
            try:
                page.close()
            except Exception:
                pass
        return [self._map(h, listing_type) for h in all_hits.values()]

    def run(self, dry_run: bool = False, deep_areas: bool = False,
            only_areas: list[str] | None = None) -> list[dict]:
        rows: list[dict] = []
        with self:
            for path, listing_type in SEARCHES:
                log.info("=== dubizzle %s (%s) ===", path, listing_type)
                try:
                    raws = self._scrape_search(path, listing_type)
                except Exception as exc:  # noqa: BLE001
                    log.exception("slice %s failed: %s", path, exc)
                    continue
                rows.extend(normalize_listing(x, self.source) for x in raws)

            # Optional DEEP per-area sweep: Ajman-wide searches bury small districts,
            # so query each area's own URL. Slugs that don't exist return 0 and are skipped.
            if deep_areas:
                from .areas import AREAS
                targets = {k: v for k, v in AREAS.items() if not only_areas or k in only_areas}
                log.info("=== dubizzle AREA SWEEP over %d area(s) ===", len(targets))
                for ak, meta in targets.items():
                    slug = _area_slug(meta["en"])
                    for path, listing_type in SEARCHES:
                        try:
                            raws = self._scrape_search(path, listing_type, area_slug=slug)
                        except Exception:  # noqa: BLE001
                            continue
                        if raws:
                            log.info("  [area sweep] %s%s: %d listings", path, slug, len(raws))
                            rows.extend(normalize_listing(x, self.source) for x in raws)

        uniq = {r["source_url"]: r for r in rows if r.get("source_url")}
        rows = list(uniq.values())
        deduped = collapse_duplicates(rows)
        log.info("dubizzle: %d after url-dedup, %d after content-dedup (-%d)",
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
