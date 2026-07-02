"""The 47 Ajman areas + a matcher that maps messy portal location text to an area_key.

Portal location text is noisy: "Al Jurf", "Jurf 2, Ajman", "الجرف 2", "Industrial Area".
`match_area()` normalises both English and Arabic and returns the best area_key, or None.
Callers should ALWAYS also store the original text as `area_raw` so unmatched rows can be
reviewed later.
"""
from __future__ import annotations

import re

try:
    from rapidfuzz import fuzz, process
    _HAS_RAPIDFUZZ = True
except ImportError:  # rapidfuzz is optional; matcher degrades gracefully without it
    _HAS_RAPIDFUZZ = False

# area_key -> canonical names (+ optional aliases for known portal spellings)
AREAS: dict[str, dict] = {
    "liwara1":    {"en": "Liwara 1",            "ar": "ليوارة 1"},
    "liwara2":    {"en": "Liwara 2",            "ar": "ليوارة 2"},
    "liwara3":    {"en": "Liwara 3",            "ar": "ليوارة 3"},
    "nakhil1":    {"en": "Al Nakhil 1",         "ar": "النخيل 1"},
    "nakhil2":    {"en": "Al Nakhil 2",         "ar": "النخيل 2"},
    "rumailah1":  {"en": "Al Rumailah 1",       "ar": "الرميلة 1",
                   "aliases": ["Al Rumaila", "Rumaila"]},
    "rumailah2":  {"en": "Al Rumailah 2",       "ar": "الرميلة 2"},
    "rumailah3":  {"en": "Al Rumailah 3",       "ar": "الرميلة 3"},
    "rashidiya1": {"en": "Al Rashidiya 1",      "ar": "الراشدية 1"},
    "rashidiya2": {"en": "Al Rashidiya 2",      "ar": "الراشدية 2"},
    "rashidiya3": {"en": "Al Rashidiya 3",      "ar": "الراشدية 3"},
    "nuaimiya1":  {"en": "Al Nuaimiya 1",       "ar": "النعيمية 1"},
    "nuaimiya2":  {"en": "Al Nuaimiya 2",       "ar": "النعيمية 2"},
    "nuaimiya3":  {"en": "Al Nuaimiya 3",       "ar": "النعيمية 3"},
    "mushairef":  {"en": "Mushairef",           "ar": "مشيرف"},
    "safia":      {"en": "Al Safia",            "ar": "الصفيا"},
    "zorah":      {"en": "Al Zorah",            "ar": "الزوراء"},
    "jurfind1":   {"en": "Al Jurf Industrial 1", "ar": "الجرف الصناعية 1"},
    "jurfind2":   {"en": "Al Jurf Industrial 2", "ar": "الجرف الصناعية 2"},
    "jurf1":      {"en": "Al Jurf 1",           "ar": "الجرف 1"},
    "jurf2":      {"en": "Al Jurf 2",           "ar": "الجرف 2"},
    "jurf3":      {"en": "Al Jurf 3",           "ar": "الجرف 3"},
    "ajmanind1":  {"en": "Ajman Industrial 1",  "ar": "عجمان الصناعية 1"},
    "ajmanind2":  {"en": "Ajman Industrial 2",  "ar": "عجمان الصناعية 2"},
    "mowaihat1":  {"en": "Al Mowaihat 1",       "ar": "المويهات 1"},
    "mowaihat2":  {"en": "Al Mowaihat 2",       "ar": "المويهات 2"},
    "mowaihat3":  {"en": "Al Mowaihat 3",       "ar": "المويهات 3"},
    "tallah1":    {"en": "Al Tallah 1",         "ar": "التلة 1"},
    "tallah2":    {"en": "Al Tallah 2",         "ar": "التلة 2"},
    "rawda1":     {"en": "Al Rawda 1",          "ar": "الروضة 1"},
    "rawda2":     {"en": "Al Rawda 2",          "ar": "الروضة 2"},
    "rawda3":     {"en": "Al Rawda 3",          "ar": "الروضة 3"},
    "mbz1":       {"en": "Mohammed Bin Zayed 1", "ar": "محمد بن زايد 1",
                   "aliases": ["MBZ 1", "Mohamed Bin Zayed City 1"]},
    "mbz2":       {"en": "Mohammed Bin Zayed 2", "ar": "محمد بن زايد 2",
                   "aliases": ["MBZ 2", "Mohamed Bin Zayed City 2"]},
    "yasmeen":    {"en": "Al Yasmeen",          "ar": "الياسمين", "aliases": ["Al Yasmin", "Jasmine"]},
    "helio1":     {"en": "Al Helio 1",          "ar": "الحليوا 1", "aliases": ["Al Hamidiyah Helio 1"]},
    "helio2":     {"en": "Al Helio 2",          "ar": "الحليوا 2"},
    "amerah":     {"en": "Al Amerah",           "ar": "العامرة"},
    "alia":       {"en": "Al Alia",             "ar": "العالية"},
    "raqaib1":    {"en": "Al Raqaib 1",         "ar": "الرقايب 1"},
    "raqaib2":    {"en": "Al Raqaib 2",         "ar": "الرقايب 2"},
    "hamidiya1":  {"en": "Al Hamidiya 1",       "ar": "الحميدية 1", "aliases": ["Al Hamidiyah 1"]},
    "hamidiya2":  {"en": "Al Hamidiya 2",       "ar": "الحميدية 2", "aliases": ["Al Hamidiyah 2"]},
    "zahia1":     {"en": "Al Zahia 1",          "ar": "الزاهية 1",
                   "aliases": ["Al Zahya", "Zahya"]},
    "zahia2":     {"en": "Al Zahia 2",          "ar": "الزاهية 2"},
    "masfout":    {"en": "Masfout",             "ar": "مصفوت", "aliases": ["Masfoot"]},
    "manama":     {"en": "Al Manama",           "ar": "المنامة"},
    # Additional real Ajman areas/developments the portals use heavily (beyond the core 47).
    "albahia":    {"en": "Al Bahia",            "ar": "الباهية", "aliases": ["Al Bahia Hills", "Bahia"]},
    "downtown":   {"en": "Ajman Downtown",      "ar": "وسط مدينة عجمان",
                   "aliases": ["Downtown Ajman", "Horizon Tower", "Horizon Towers", "Falcon Tower", "Falcon Towers", "Conquer Tower", "City Tower", "Ajman One"]},
    "corniche":   {"en": "Ajman Corniche",      "ar": "كورنيش عجمان",
                   "aliases": ["Corniche Ajman", "Ajman Corniche Residence", "Ajman Corniche Residences", "Corniche Tower", "Corniche Road"]},
    "bustan":     {"en": "Al Bustan",           "ar": "البستان"},
    "emiratescity": {"en": "Emirates City",     "ar": "مدينة الإمارات",
                     "aliases": ["Emirates Lake Towers", "Lavender Tower", "Paradise Lakes", "Ajman Pearl"]},
    "uptown":     {"en": "Ajman Uptown",        "ar": "أب تاون عجمان", "aliases": ["Uptown Ajman"]},
    "freezone":   {"en": "Ajman Free Zone",     "ar": "منطقة عجمان الحرة", "aliases": ["Free Zone"]},
}

assert len(AREAS) >= 47, f"expected at least 47 areas, got {len(AREAS)}"


# --------------------------------------------------------------------------- #
# normalisation
# --------------------------------------------------------------------------- #
_AR_DIACRITICS = re.compile(r"[ً-ْـ]")          # tashkeel + tatweel
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_WORD_NUMS = {"one": "1", "two": "2", "three": "3", "first": "1", "second": "2", "third": "3"}


def _norm(text: str) -> str:
    """Lowercase, transliterate digits, strip the Arabic/English definite article,
    drop punctuation. Applied identically to area names and raw text so they line up."""
    if not text:
        return ""
    t = str(text).strip().lower().translate(_ARABIC_DIGITS)
    # arabic letter normalisation
    t = _AR_DIACRITICS.sub("", t)
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه")):
        t = t.replace(a, b)
    t = t.replace("ال", "")                       # arabic definite article "al-"
    t = t.replace("&", " and ")
    t = re.sub(r"[^0-9a-z؀-ۿ ]+", " ", t)  # keep latin, arabic, digits
    t = re.sub(r"\bal\b", " ", t)                  # english "Al" prefix
    for w, d in _WORD_NUMS.items():
        t = re.sub(rf"\b{w}\b", d, t)
    return re.sub(r"\s+", " ", t).strip()


def _variants(key: str) -> set[str]:
    a = AREAS[key]
    out = {_norm(a["en"]), _norm(a.get("ar", ""))}
    for al in a.get("aliases", []):
        out.add(_norm(al))
    return {v for v in out if v}


def _base(s: str) -> str:
    """Drop a trailing number -> parent group, e.g. 'jurf 2' -> 'jurf'."""
    return re.sub(r"\s*\d+\s*$", "", s).strip()


# variant string -> area_key (first writer wins, so canonical names dominate)
_VARIANT_TO_KEY: dict[str, str] = {}
# parent group -> [area_keys] (for "Al Jurf" with no number)
_BASE_TO_KEYS: dict[str, list[str]] = {}
for _k in AREAS:
    for _v in _variants(_k):
        _VARIANT_TO_KEY.setdefault(_v, _k)
        _b = _base(_v)
        if _b and _b != _v:
            _BASE_TO_KEYS.setdefault(_b, [])
            if _k not in _BASE_TO_KEYS[_b]:
                _BASE_TO_KEYS[_b].append(_k)


def match_area(raw: str | None) -> str | None:
    """Map messy portal location text to an area_key, or None if no confident match."""
    n = _norm(raw or "")
    if not n:
        return None

    # 1) exact normalised match
    if n in _VARIANT_TO_KEY:
        return _VARIANT_TO_KEY[n]

    # 2) a known area name appears inside the raw text (prefer the longest match)
    for v in sorted(_VARIANT_TO_KEY, key=len, reverse=True):
        if len(v) >= 4 and v in n:
            return _VARIANT_TO_KEY[v]

    # 3) only a parent name matched (e.g. "Al Jurf") -> pick its first sub-area
    nb = _base(n)
    if nb in _BASE_TO_KEYS:
        return sorted(_BASE_TO_KEYS[nb])[0]
    for b in sorted(_BASE_TO_KEYS, key=len, reverse=True):
        if len(b) >= 4 and b in n:
            return sorted(_BASE_TO_KEYS[b])[0]

    # 4) fuzzy fallback
    if _HAS_RAPIDFUZZ:
        best = process.extractOne(n, list(_VARIANT_TO_KEY), scorer=fuzz.token_set_ratio)
        if best and best[1] >= 88:
            return _VARIANT_TO_KEY[best[0]]

    return None


if __name__ == "__main__":  # quick self-test: python -m scrapers.areas
    tests = ["Al Jurf 2, Ajman", "الجرف 2", "Jurf", "Industrial Area", "Al Nuaimiya 3",
             "المويهات 1", "Masfout", "MBZ 1", "somewhere in Dubai"]
    for t in tests:
        print(f"{t!r:32} -> {match_area(t)}")
