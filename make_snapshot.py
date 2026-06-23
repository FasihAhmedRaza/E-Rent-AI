"""Regenerate the web app's data snapshot from Supabase.

Run this AFTER scraping to refresh the dashboard:
    python run_scrape.py        # scrape the 3 portals -> Supabase
    python make_snapshot.py     # Supabase -> webapp/public/landData.json

It rebuilds webapp/public/landData.json (areas + per-type value stats + listings),
reusing the geocoded coordinates in webapp/public/area_coords.json when present.
"""
from __future__ import annotations

import json
import os
import statistics
from collections import defaultdict

from db.client import get_client
from scrapers.areas import AREAS as AREA_NAMES

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "webapp", "public")

# per-area trend (%) + coast flag + fallback coordinate (used if not geocoded)
META = {
    "liwara1":[25.4050,55.4480,4,1],"liwara2":[25.4082,55.4520,4,1],"liwara3":[25.4020,55.4500,3,1],
    "nakhil1":[25.3980,55.4555,3,1],"nakhil2":[25.4010,55.4585,3,1],"rumailah1":[25.4120,55.4500,4,1],
    "rumailah2":[25.4150,55.4530,5,1],"rumailah3":[25.4090,55.4470,4,1],"rashidiya1":[25.4080,55.4580,2,0],
    "rashidiya2":[25.4110,55.4620,2,0],"rashidiya3":[25.4050,55.4600,1,0],"nuaimiya1":[25.3960,55.4780,2,0],
    "nuaimiya2":[25.3990,55.4820,2,0],"nuaimiya3":[25.3930,55.4760,1,0],"mushairef":[25.4020,55.4700,3,0],
    "safia":[25.4000,55.4740,2,0],"zorah":[25.4385,55.4720,6,1],"jurfind1":[25.4200,55.5180,1,0],
    "jurfind2":[25.4230,55.5220,1,0],"jurf1":[25.4130,55.5060,3,0],"jurf2":[25.4160,55.5100,3,0],
    "jurf3":[25.4100,55.5140,2,0],"ajmanind1":[25.4040,55.5280,-1,0],"ajmanind2":[25.4070,55.5320,-1,0],
    "mowaihat1":[25.3800,55.4900,2,0],"mowaihat2":[25.3770,55.4940,1,0],"mowaihat3":[25.3830,55.4860,2,0],
    "tallah1":[25.3950,55.5000,2,0],"tallah2":[25.3920,55.5040,2,0],"rawda1":[25.3880,55.4900,2,0],
    "rawda2":[25.3850,55.4940,3,0],"rawda3":[25.3910,55.4880,2,0],"mbz1":[25.3600,55.5050,3,0],
    "mbz2":[25.3570,55.5090,3,0],"yasmeen":[25.3700,55.5000,2,0],"helio1":[25.3680,55.5160,2,0],
    "helio2":[25.3650,55.5200,2,0],"amerah":[25.3750,55.5300,1,0],"alia":[25.3850,55.5200,2,0],
    "raqaib1":[25.3950,55.5400,0,0],"raqaib2":[25.3980,55.5440,0,0],"hamidiya1":[25.3820,55.5040,1,0],
    "hamidiya2":[25.3790,55.5080,1,0],"zahia1":[25.3880,55.5100,5,0],"zahia2":[25.3910,55.5140,5,0],
    "masfout":[24.7950,56.0600,1,0],"manama":[25.3400,56.0000,1,0],
}
TYPE_MAP = {"commercial_land":"commercial","industrial_land":"industrial",
            "mixed_use_land":"mixed","residential_land":"residential","land":"residential"}


def med(l):
    return round(statistics.median(l)) if l else None


def main():
    sb = get_client()
    rows = []
    for off in range(0, 30000, 1000):
        ch = sb.table("listings").select(
            "source,title,price,size_sqft,price_per_sqft,area_key,listing_type,subtype,source_url"
        ).range(off, off + 999).execute().data
        if not ch:
            break
        rows += ch

    coords = {}
    cp = os.path.join(PUB, "area_coords.json")
    if os.path.exists(cp):
        coords = json.load(open(cp, encoding="utf-8"))

    listings = [{
        "id": i, "area": r.get("area_key"), "type": TYPE_MAP.get(r.get("subtype"), "residential"),
        "size": r.get("size_sqft"), "value": r.get("price"), "ppsf": r.get("price_per_sqft"),
        "src": r.get("source"), "lt": r.get("listing_type"), "url": r.get("source_url"), "title": r.get("title"),
    } for i, r in enumerate(rows)]

    sale = [l for l in listings if l["lt"] == "sale" and l["area"] and l["value"] and l["ppsf"]]
    by_area = defaultdict(list)
    for l in sale:
        by_area[l["area"]].append(l)

    areas = []
    for ak, ls in by_area.items():
        m = META.get(ak, [25.4, 55.5, 0, 0])
        ll = coords.get(ak) or [m[0], m[1]]
        bytype = {}
        for t in ("commercial", "industrial", "residential", "mixed"):
            tl = [x for x in ls if x["type"] == t]
            if tl:
                vals = sorted(x["value"] for x in tl)
                bytype[t] = {"n": len(tl), "ppsf": med([x["ppsf"] for x in tl]),
                             "vlow": vals[0], "vavg": med(vals), "vhigh": vals[-1]}
        vals = sorted(x["value"] for x in ls)
        areas.append({
            "key": ak, "en": AREA_NAMES.get(ak, {}).get("en", ak), "ar": AREA_NAMES.get(ak, {}).get("ar", ""),
            "ll": ll, "trend": m[2], "coast": bool(m[3]),
            "ppsf": med([x["ppsf"] for x in ls]), "n": len(ls),
            "vlow": vals[0], "vavg": med(vals), "vhigh": vals[-1], "bytype": bytype,
            "sources": {s: med([x["ppsf"] for x in ls if x["src"] == s]) for s in ("bayut", "dubizzle", "propertyfinder")},
        })
    areas.sort(key=lambda a: -a["n"])

    allppsf = sorted(x["ppsf"] for x in sale)
    kpis = {
        "total_listings": len(rows), "sale": len(sale), "areas": len(areas),
        "median_ppsf": med(allppsf), "p10": allppsf[len(allppsf)//10] if allppsf else None,
        "p90": allppsf[9*len(allppsf)//10] if allppsf else None,
        "by_source": {s: sum(1 for r in rows if r["source"] == s) for s in ("bayut", "dubizzle", "propertyfinder")},
    }
    out = {"meta": {"yieldDefault": 0.065, "yieldMin": 0.05, "yieldMax": 0.08},
           "kpis": kpis, "areas": areas, "listings": listings}
    json.dump(out, open(os.path.join(PUB, "landData.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"snapshot written: {len(listings)} listings, {len(areas)} areas, median ppsf {kpis['median_ppsf']}")


if __name__ == "__main__":
    main()
