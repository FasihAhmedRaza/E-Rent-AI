"""Clean raw scraped fields and shape a raw listing into a `listings` table row.

Portal scrapers extract whatever they can into a loose dict; `normalize_listing()`
turns that into the canonical schema (price/size parsed, price_per_sqft computed,
listing_type / category / subtype inferred, area matched).
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from .areas import match_area

SQM_TO_SQFT = 10.7639


def parse_price(value) -> float | None:
    """'AED 120,000 /year' -> 120000.0 ; handles k / m suffixes."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    t = str(value).lower().replace(",", "").strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(m|million|k|thousand)?", t)
    if not m:
        return None
    val = float(m.group(1))
    unit = m.group(2)
    if unit in ("m", "million"):
        val *= 1_000_000
    elif unit in ("k", "thousand"):
        val *= 1_000
    return val if val > 0 else None


def parse_size(value) -> float | None:
    """Return size in SQFT. Converts sqm -> sqft when the unit is detected."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    t = str(value).lower().replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)", t)
    if not m:
        return None
    val = float(m.group(1))
    if any(u in t for u in ("sqm", "sq.m", "sq m", "square met", "m²", "متر")):
        val *= SQM_TO_SQFT
    return round(val, 2) if val > 0 else None


def parse_int(value) -> int | None:
    if value is None:
        return None
    m = re.search(r"\d+", str(value))
    return int(m.group()) if m else None


def detect_listing_type(text: str) -> str | None:
    t = (text or "").lower()
    if any(w in t for w in ("rent", "lease", "yearly", "/year", "per year", "إيجار", "للايجار")):
        return "rent"
    if any(w in t for w in ("sale", "buy", "sell", "للبيع", "بيع")):
        return "sale"
    return None


_LAND_WORDS = ("land", "plot", "قطعة", "ارض", "أرض")
_UNIT_SUBTYPES = {
    "office": ("office", "مكتب"),
    "shop": ("shop", "retail", "محل"),
    "showroom": ("showroom", "معرض"),
    "warehouse": ("warehouse", "storage", "مستودع", "مخزن"),
    "labour_camp": ("labour camp", "staff accommodation", "سكن عمال"),
}
_LAND_SUBTYPES = {
    "commercial_land": ("commercial land", "commercial plot"),
    "residential_land": ("residential land", "residential plot"),
    "industrial_land": ("industrial land", "industrial plot"),
    "mixed_use_land": ("mixed use", "mixed-use"),
}


def detect_category_subtype(text: str) -> tuple[str | None, str | None]:
    """Return (category, subtype). category in {'land','commercial_unit'} or None."""
    t = (text or "").lower()
    for sub, kws in _LAND_SUBTYPES.items():
        if any(k in t for k in kws):
            return "land", sub
    for sub, kws in _UNIT_SUBTYPES.items():
        if any(k in t for k in kws):
            return "commercial_unit", sub
    if any(k in t for k in _LAND_WORDS):
        return "land", "land"
    return None, None


_RENT_SIGNALS = ("for annual rent", "annual rent", "for rent", "for lease", "to let",
                 "yearly", "per year", "/year", "للايجار", "للإيجار")
_COWORK = ("co-work", "coworking", "co working", "hot desk", "hotdesk", "dedicated desk",
           "flexi desk", "flexi-desk", "workspace", "work space", "shared office", "shared desk")


def _strong_rent_signal(text: str) -> bool:
    t = (text or "").lower()
    return any(s in t for s in _RENT_SIGNALS)


def _is_coworking(text: str) -> bool:
    t = (text or "").lower()
    return any(s in t for s in _COWORK)


def normalize_listing(raw: dict, source: str) -> dict:
    """Map a raw portal dict to a `listings` row. Unknown fields fall back to None."""
    blob = " ".join(
        str(raw.get(k, ""))
        for k in ("title", "property_type", "purpose", "category", "subtype", "listing_type")
    )
    price = parse_price(raw.get("price"))
    size = parse_size(raw.get("size"))
    ppsf = round(price / size, 2) if (price and size) else None

    listing_type = raw.get("listing_type") or detect_listing_type(blob)
    category = raw.get("category")
    subtype = raw.get("subtype")
    if not category:
        category, subtype = detect_category_subtype(blob)

    title = raw.get("title") or ""
    # reconcile the portal's structured purpose against an unambiguous title intent:
    # only flip a 'sale' to rent when the price is implausibly low for a sale AND the
    # title clearly says rent/lease — avoids wrongly flipping high-value investment
    # sales that merely mention rental potential.
    if listing_type == "sale" and price and price < 200_000 and _strong_rent_signal(title):
        listing_type = "rent"
    # coworking desks masquerade as 'office' rentals and wreck office rent/sqft —
    # split them into their own subtype so valuation can exclude them
    if subtype == "office" and (_is_coworking(title) or (size is not None and size < 150)):
        subtype = "coworking"

    period = raw.get("price_period")
    if listing_type == "sale":
        period = "total"
    elif not period or period == "total":
        period = "year"

    area_raw = (raw.get("area_raw") or raw.get("location") or "").strip()

    return {
        "source": source,
        "source_url": raw.get("source_url"),
        "listing_type": listing_type,
        "category": category,
        "subtype": subtype,
        "area_key": match_area(area_raw),
        "area_raw": area_raw or None,
        "emirate": "Ajman",
        "price": price,
        "price_period": period,
        "size_sqft": size,
        "price_per_sqft": ppsf,
        "beds": parse_int(raw.get("beds")),
        "baths": parse_int(raw.get("baths")),
        "title": (raw.get("title") or "").strip() or None,
        "listed_date": raw.get("listed_date"),
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "raw": raw,
    }


def collapse_duplicates(rows: list[dict]) -> list[dict]:
    """Drop content-level repeats (same title + price + size) that have distinct
    source_urls — i.e. agent-spam reposts the source_url de-dup can't catch.
    Keeps one row per (title, price, size_sqft)."""
    seen = set()
    out = []
    for r in rows:
        key = ((r.get("title") or "").strip().lower(), r.get("price"), r.get("size_sqft"))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out
