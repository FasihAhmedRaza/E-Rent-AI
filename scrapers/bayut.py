"""Bayut (bayut.com) scraper — Ajman land + commercial units, rent + sale.

Strategy (proven by recon + live debugging): Bayut server-renders each search
page and embeds the full result set as a JSON blob assigned to **`window.state`**
in the HTML, with the listing objects at `state.algolia.content.hits`. We navigate
each Ajman search URL (pagination is URL-based: /page-2/, /page-3/ ...) and parse
that blob straight out of the page HTML — no Algolia key, no CAPTCHA needed, since
the data is in the page on load.

We parse the blob from the raw HTML (page.content()) rather than reading the live
`window.state` object, because the React app mutates that object after hydration.

IMPORTANT: Bayut's `area` field is in SQUARE METRES, not sqft — we convert.

All Bayut-specific knowledge (URLs, category map, field mapping) lives here so a
site change only touches this file.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from db.client import upsert_listings

from .base import BaseScraper
from .normalize import collapse_duplicates, normalize_listing

log = logging.getLogger("scraper.bayut")

BASE = "https://www.bayut.com"
SQM_TO_SQFT = 10.7639

# our (category, subtype) per Bayut category-slug used in the search URL
CATEGORY_MAP = {
    "commercial-plots": ("land", "commercial_land"),
    "industrial-land": ("land", "industrial_land"),
    "offices": ("commercial_unit", "office"),
    "shops": ("commercial_unit", "shop"),
    "warehouses": ("commercial_unit", "warehouse"),
    "showrooms": ("commercial_unit", "showroom"),
}

# (url purpose segment, category slug, our listing_type)
# LAND plots — the current project focus (commercial plots + industrial land), 2026-06-22.
SEARCHES = [
    ("to-rent", "commercial-plots", "rent"),
    ("for-sale", "commercial-plots", "sale"),
    ("to-rent", "industrial-land", "rent"),
    ("for-sale", "industrial-land", "sale"),
]

# COMMERCIAL UNITS — PARKED (scope is land plots only). Re-enable with
# BayutScraper(); s.include_commercial = True.
COMMERCIAL_SEARCHES = [
    ("to-rent", "offices", "rent"),
    ("for-sale", "offices", "sale"),
    ("to-rent", "shops", "rent"),
    ("for-sale", "shops", "sale"),
    ("to-rent", "warehouses", "rent"),
    ("for-sale", "warehouses", "sale"),
]


def _page_url(purpose: str, cat_slug: str, page: int) -> str:
    base = f"{BASE}/{purpose}/{cat_slug}/ajman/"
    return base if page <= 1 else f"{base}page-{page}/"


def _extract_state(html: str):
    """Brace-match the `window.state = {...}` JSON object out of the page HTML."""
    i = html.find("window.state")
    if i < 0:
        return None
    start = html.find("{", html.find("=", i))
    if start < 0:
        return None
    depth = 0
    instr = False
    esc = False
    quote = ""
    j, n = start, len(html)
    while j < n:
        c = html[j]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                instr = False
        elif c in ('"', "'"):
            instr = True
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    try:
        return json.loads(html[start:j + 1])
    except Exception:
        return None


def _to_date(value):
    if not value:
        return None
    try:
        if isinstance(value, (int, float)) or str(value).isdigit():
            return datetime.fromtimestamp(int(value), tz=timezone.utc).date().isoformat()
        return str(value)[:10]
    except Exception:
        return None


def _area_raw(hit: dict) -> str:
    """Build the location string from the hit's location hierarchy (skip 'UAE')."""
    loc = hit.get("location")
    if isinstance(loc, list):
        return ", ".join(
            l.get("name", "") for l in loc
            if isinstance(l, dict) and l.get("level", 9) >= 1 and l.get("name")
        )
    return ""


class BayutScraper(BaseScraper):
    source = "bayut"
    include_commercial = False  # scope = land only; set True to also scrape commercial units

    @staticmethod
    def _hits(state) -> list:
        try:
            return state["algolia"]["content"]["hits"] or []
        except (TypeError, KeyError):
            return []

    @staticmethod
    def _nb_pages(state):
        try:
            return state["algolia"]["content"].get("nbPages")
        except (TypeError, KeyError, AttributeError):
            return None

    def _map(self, hit: dict, listing_type: str, category, subtype) -> dict:
        ext = hit.get("externalID") or hit.get("objectID")
        area_sqm = hit.get("area") or hit.get("plotArea")
        size_sqft = round(float(area_sqm) * SQM_TO_SQFT, 2) if area_sqm else None
        freq = (hit.get("rentFrequency") or "").lower()
        period = "total" if listing_type == "sale" else \
            {"monthly": "month", "weekly": "week", "daily": "day", "yearly": "year"}.get(freq, "year")
        return {
            "source_url": f"{BASE}/property/details-{ext}.html" if ext else None,
            "title": hit.get("title"),
            "price": hit.get("price"),
            "price_period": period,
            "size": size_sqft,                 # already converted sqm -> sqft
            "area_raw": _area_raw(hit),
            "listing_type": listing_type,
            "category": category,
            "subtype": subtype,
            "beds": hit.get("rooms") or None,
            "baths": hit.get("baths") or None,
            "listed_date": _to_date(hit.get("createdAt")),
            "external_id": ext,
        }

    def _scrape_search(self, purpose: str, cat_slug: str, listing_type: str) -> list[dict]:
        category, subtype = CATEGORY_MAP.get(cat_slug, (None, None))
        page = self.new_page()
        all_hits: dict = {}
        try:
            for pg in range(1, self.max_pages + 1):
                if not self.goto(page, _page_url(purpose, cat_slug, pg)):
                    break
                page.wait_for_timeout(800)
                html = page.content()
                state = _extract_state(html)
                hits = self._hits(state)
                if not hits:
                    log.warning("  %s/%s page %d: 0 hits (html_len=%d window.state=%s captcha=%s)",
                                purpose, cat_slug, pg, len(html),
                                "window.state" in html, "captcha" in html.lower())
                    break
                fresh = 0
                for h in hits:
                    ext = str(h.get("externalID") or h.get("objectID") or "")
                    if ext and ext not in all_hits:
                        all_hits[ext] = h
                        fresh += 1
                nb = self._nb_pages(state)
                log.info("  %s/%s page %d: %d hits (+%d new, total %d, nbPages=%s)",
                         purpose, cat_slug, pg, len(hits), fresh, len(all_hits), nb)
                if fresh == 0 or (nb and pg >= nb):
                    break
        finally:
            try:
                page.close()
            except Exception:
                pass
        return [self._map(h, listing_type, category, subtype) for h in all_hits.values()]

    def run(self, dry_run: bool = False) -> list[dict]:
        rows: list[dict] = []
        searches = SEARCHES + (COMMERCIAL_SEARCHES if self.include_commercial else [])
        with self:
            for purpose, cat_slug, listing_type in searches:
                log.info("=== bayut %s %s (%s) ===", cat_slug, listing_type, purpose)
                try:
                    raws = self._scrape_search(purpose, cat_slug, listing_type)
                except Exception as exc:  # noqa: BLE001
                    log.exception("slice %s/%s failed: %s", purpose, cat_slug, exc)
                    continue
                rows.extend(normalize_listing(r, self.source) for r in raws)

        uniq = {r["source_url"]: r for r in rows if r.get("source_url")}
        rows = list(uniq.values())
        deduped = collapse_duplicates(rows)
        log.info("bayut: %d listings after url-dedup, %d after content-dedup (-%d repeats/spam)",
                 len(rows), len(deduped), len(rows) - len(deduped))
        rows = deduped
        if rows:
            s = rows[0]
            log.info("SAMPLE — title=%r price=%s size_sqft=%s ppsf=%s area_key=%s area_raw=%r",
                     s.get("title"), s.get("price"), s.get("size_sqft"),
                     s.get("price_per_sqft"), s.get("area_key"), s.get("area_raw"))
        if dry_run:
            log.info("dry-run: NOT writing to DB.")
        elif rows:
            upsert_listings(rows)
        return rows
