# CLAUDE.md — Ajman Land Intelligence Platform

> Project memory and instructions for Claude Code. Read this fully before doing any work.

Project Name : E-Rent AI
---

## 1. What we are building

An **internal real-estate intelligence platform** for a commercial property entity in **Ajman, UAE**. It values **land** and **commercial units** across all of Ajman and shows rent ranges, market data, and AI insights.

A working **prototype** (single-file HTML/JS demo) is already done and approved by the client. We are now building the **real production version** with live data and a proper full-stack architecture.

**The client's contact:** Ahmed (Land Management Department). The client wants accurate, auto-updated valuation data.

---

## 2. CURRENT FOCUS — START HERE 🎯

**Phase 1: Build the data scrapers.**

The client will **NOT** provide data. We collect it ourselves by scraping three property portals on a schedule, for **all Ajman areas**:

1. **Bayut** (bayut.com)
2. **Dubizzle** (dubizzle.com / ae.dubizzle.com)
3. **Property Finder** (propertyfinder.ae)

We need both **rent** and **sale** listings, for both **land** (plots) and **commercial units** (offices, shops, warehouses), filtered to **Ajman**.

**Deliverable for Phase 1:** working scrapers that pull listings from the 3 portals → clean/normalize them → save to a database. Nothing else yet (no frontend, no API).

**Do NOT start the frontend or API until Phase 1 data is flowing.**

---

## 3. Business context (the requirements)

The client agreed to these 6 points:

1. **Commercial units** valued using market data from Bayut, Dubizzle, and Property Finder.
2. **Land** sale/purchase prices from **ARRA** (Ajman Real Estate Regulatory Agency). Land **rent** is then calculated using a **5%–8% yield** on the land value.
3. Cover **all 47 Ajman areas/districts** (list in section 6).
4. Map with **Satellite** + **Standard** views.
5. **AI features** (voice assistant, ROI calculator, opportunity map, reports) — already designed in the prototype.
6. Valuation based on **accurate, automatically updated** data.

---

## 4. Valuation methodology (important)

- **Commercial units** → use scraped **market rent/sale** prices from the 3 portals directly (per area, per type).
- **Land** → take the **land sale price** (AED/sqft) and compute annual rent:

  ```
  annual_rent = land_value × yield
  yield range = 5% to 8%   (default mid-point = 6.5%, must stay configurable)
  ```

- Land value source priority:
  1. **ARRA official land prices** (best — needs official access/agreement; client may not provide).
  2. If ARRA access is not available → **estimate land value from SALE listings** of plots on the portals. Less accurate but workable.

---

## 5. Data sources — reality & rules

- These portals have **no official public API**. Data must be **scraped**.
- Scraping notes (handle carefully):
  - Sites use **anti-bot protection** (e.g. Cloudflare). Use a real browser engine (Playwright), realistic headers, and **random delays**.
  - Use **rotating proxies** if IPs get blocked.
  - **Respect low request rates.** Do not hammer the sites. This is for internal market research.
  - Site layouts change → scrapers break → expect **ongoing maintenance**. Keep selectors in one place per portal so they are easy to fix.
- **ARRA** = the official regulator (ajmanre.gov.ae, open data at data.ajman.ae). Check if land prices/transactions are available there. If not, we estimate from sale listings (see section 4).

---

## 6. Coverage — the 47 Ajman areas

Use these exact keys in the database (`area_key`). Each has English + Arabic names.

| key | English | Arabic |
|---|---|---|
| liwara1 | Liwara 1 | ليوارة 1 |
| liwara2 | Liwara 2 | ليوارة 2 |
| liwara3 | Liwara 3 | ليوارة 3 |
| nakhil1 | Al Nakhil 1 | النخيل 1 |
| nakhil2 | Al Nakhil 2 | النخيل 2 |
| rumailah1 | Al Rumailah 1 | الرميلة 1 |
| rumailah2 | Al Rumailah 2 | الرميلة 2 |
| rumailah3 | Al Rumailah 3 | الرميلة 3 |
| rashidiya1 | Al Rashidiya 1 | الراشدية 1 |
| rashidiya2 | Al Rashidiya 2 | الراشدية 2 |
| rashidiya3 | Al Rashidiya 3 | الراشدية 3 |
| nuaimiya1 | Al Nuaimiya 1 | النعيمية 1 |
| nuaimiya2 | Al Nuaimiya 2 | النعيمية 2 |
| nuaimiya3 | Al Nuaimiya 3 | النعيمية 3 |
| mushairef | Mushairef | مشيرف |
| safia | Al Safia | الصفيا |
| zorah | Al Zorah | الزوراء |
| jurfind1 | Al Jurf Industrial 1 | الجرف الصناعية 1 |
| jurfind2 | Al Jurf Industrial 2 | الجرف الصناعية 2 |
| jurf1 | Al Jurf 1 | الجرف 1 |
| jurf2 | Al Jurf 2 | الجرف 2 |
| jurf3 | Al Jurf 3 | الجرف 3 |
| ajmanind1 | Ajman Industrial 1 | عجمان الصناعية 1 |
| ajmanind2 | Ajman Industrial 2 | عجمان الصناعية 2 |
| mowaihat1 | Al Mowaihat 1 | المويهات 1 |
| mowaihat2 | Al Mowaihat 2 | المويهات 2 |
| mowaihat3 | Al Mowaihat 3 | المويهات 3 |
| tallah1 | Al Tallah 1 | التلة 1 |
| tallah2 | Al Tallah 2 | التلة 2 |
| rawda1 | Al Rawda 1 | الروضة 1 |
| rawda2 | Al Rawda 2 | الروضة 2 |
| rawda3 | Al Rawda 3 | الروضة 3 |
| mbz1 | Mohammed Bin Zayed 1 | محمد بن زايد 1 |
| mbz2 | Mohammed Bin Zayed 2 | محمد بن زايد 2 |
| yasmeen | Al Yasmeen | الياسمين |
| helio1 | Al Helio 1 | الحليوا 1 |
| helio2 | Al Helio 2 | الحليوا 2 |
| amerah | Al Amerah | العامرة |
| alia | Al Alia | العالية |
| raqaib1 | Al Raqaib 1 | الرقايب 1 |
| raqaib2 | Al Raqaib 2 | الرقايب 2 |
| hamidiya1 | Al Hamidiya 1 | الحميدية 1 |
| hamidiya2 | Al Hamidiya 2 | الحميدية 2 |
| zahia1 | Al Zahia 1 | الزاهية 1 |
| zahia2 | Al Zahia 2 | الزاهية 2 |
| masfout | Masfout | مصفوت |
| manama | Al Manama | المنامة |

> Note: portal listings may use a parent area name (e.g. "Al Jurf", "Al Rumailah") without the number. Map these to the closest sub-area, or store the parent and refine later. Keep an `area_raw` field with the original text from the site.

---

## 7. Recommended tech stack

Keep it simple and reliable.

- **Language:** Python 3.11+
- **Scraping:** **Playwright** (handles JS-heavy sites + anti-bot better than `requests`). Use `BeautifulSoup` or Playwright locators for parsing.
- **Data handling:** `pandas` for cleaning.
- **Database:** **PostgreSQL** (or **Supabase**, which we already use — Supabase = Postgres + easy access).
- **DB access:** `supabase-py` or `SQLAlchemy` + `psycopg2`.
- **Scheduling (later in phase 5):** cron on a VPS, or GitHub Actions on a schedule.
- **Config/secrets:** `.env` file via `python-dotenv`.

(Frontend later will be **Next.js + React**, reusing the prototype's premium UI. Not now.)

---

## 8. Proposed project structure

```
ajman-platform/
├── CLAUDE.md                  # this file
├── .env.example               # template for secrets (commit this)
├── .env                       # real secrets (DO NOT commit)
├── .gitignore
├── requirements.txt
├── scrapers/
│   ├── __init__.py
│   ├── base.py                # BaseScraper: browser setup, delays, proxy, retry
│   ├── bayut.py               # Bayut scraper
│   ├── dubizzle.py            # Dubizzle scraper
│   ├── propertyfinder.py      # Property Finder scraper
│   ├── areas.py               # the 47 areas list + area-matching helper
│   └── normalize.py           # clean/standardize a raw listing into our schema
├── db/
│   ├── schema.sql             # database tables
│   └── client.py              # DB connection + upsert functions
├── run_scrape.py              # entrypoint: scrape all portals → save to DB
└── data/                      # local CSV dumps (gitignored)
```

---

## 9. Database schema (Phase 1)

**Table: `areas`** — seed once from section 6.
```
area_key (text, PK) | name_en (text) | name_ar (text)
```

**Table: `listings`** — one row per scraped listing.
```
id              bigserial PK
source          text        -- 'bayut' | 'dubizzle' | 'propertyfinder'
source_url      text UNIQUE  -- used to de-duplicate (upsert on this)
listing_type    text        -- 'rent' | 'sale'
category        text        -- 'land' | 'commercial_unit'
subtype         text        -- 'commercial_land','residential_land','industrial_land','office','shop','warehouse', etc.
area_key        text        -- FK to areas (best match)
area_raw        text        -- original location text from the site
emirate         text        -- always 'Ajman'
price           numeric     -- AED
price_period    text        -- 'year' | 'total' (rent is usually yearly)
size_sqft       numeric
price_per_sqft  numeric     -- computed = price / size_sqft
beds            int          -- nullable (for units)
baths           int          -- nullable
title           text
listed_date     date         -- nullable, if the site shows it
scraped_at      timestamptz  -- now()
raw             jsonb        -- the full raw extracted object, for debugging
```

**Upsert rule:** de-duplicate on `source_url`. If a listing already exists, update price/size/scraped_at.

---

## 10. Phase 1 — step-by-step plan

Do these in order. Verify each step works before moving on.

1. **Setup:** create the project structure, `requirements.txt`, `.env.example`, `.gitignore` (ignore `.env`, `data/`, `__pycache__/`). Install Playwright + browsers.
2. **DB:** create `db/schema.sql`, connect, and seed the `areas` table from section 6.
3. **Base scraper:** in `scrapers/base.py`, set up a reusable Playwright browser with realistic headers, random delays (e.g. 2–6s), optional proxy support, and a retry wrapper.
4. **One portal first (start with Bayut):**
   - Find the Ajman search URL for "commercial land for rent" (and for sale). **Inspect the live page** to get the listing-card selectors — do not assume; the site decides the structure.
   - Extract per card: price, location/area, size, property type, beds/baths (if any), title, listing URL, date.
   - Handle **pagination** (loop through pages until no more results).
   - Pass each raw card through `normalize.py` → map to our schema → match `area_key`.
   - Save to DB (upsert on `source_url`).
5. **Test Bayut end-to-end:** run it, confirm rows land in the DB with correct area matching and `price_per_sqft`.
6. **Repeat for Dubizzle and Property Finder** (same pattern, different selectors).
7. **Cover all categories:** rent + sale, land + commercial units, across all 47 areas (loop areas or use Ajman-wide search and match areas after).
8. **`run_scrape.py`:** one command runs all 3 portals and reports counts (e.g. "Bayut: 312 listings, Dubizzle: 188, PF: 240").

**Keep selectors isolated per portal file** so when a site changes, only one file needs fixing.

---

## 11. Area matching

Portal location text is messy ("Al Jurf", "Jurf 2, Ajman", "الجرف"). In `scrapers/areas.py`, write a matcher:
- Normalize text (lowercase, strip "Al ", handle Arabic).
- Match against the 47 area names (EN + AR).
- If only a parent matches (e.g. "Al Jurf"), pick the parent or nearest sub-area, and always keep `area_raw`.
- If nothing matches, store `area_key = null` and `area_raw` = original, so we can review later.

---

## 12. Conventions & rules

- **Secrets** (DB URL, proxy creds) go in `.env` only. Never hardcode. Never commit `.env`.
- **Never commit scraped data** or large CSVs (gitignore `data/`).
- Scrapers must be **idempotent** — re-running updates existing rows, not duplicates them.
- **Log clearly**: how many listings found per area/portal, and any errors.
- **Be polite to the sites**: random delays, low concurrency, stop if blocked. This is internal market research.
- Write **small, modular** functions. One file per portal.
- Keep the **5–8% yield configurable** (env var or config), default 6.5% — needed in Phase 2.

---

## 13. Full roadmap (after Phase 1)

- **Phase 1 — Scraping (NOW):** 3 portals → clean → DB. ✅ when data flows.
- **Phase 2 — Valuation engine:** ARRA land prices (official access OR estimate from sale listings) + compute land rent = value × yield (5–8%). Aggregate per area/type.
- **Phase 3 — Backend API:** expose areas, listings, valuations, and summary stats (REST or Next.js API routes / FastAPI).
- **Phase 4 — Frontend:** port the approved prototype UI to **Next.js + React** (premium dark + gold design, bilingual AR/EN, the same pages: Overview, Map, Listings, Trends, Insights, AI Assistant, AI Studio).
- **Phase 5 — Automation:** schedule scrapers (daily/weekly), monitoring + alerts if a scraper breaks, "last updated" timestamps in the UI.

---

## 14. Prototype reference

The approved prototype shows the exact UX, pages, and data shape we are recreating with real data:
- Pages: Overview (rent range + KPIs + by-area bars), Map (Standard/Satellite/Offline + per-area markers), Listings (table + plot detail page), Trends (history + 3-month forecast), Insights (Executive Dashboard + Opportunity Map + Area Comparison), AI Assistant (voice, AR/EN), AI Studio (Rent Estimator + AI Report + ROI Calculator).
- Methodology already implemented in the demo: land rent = ARRA value × yield; 3 market sources; 47 areas.

Keep the production data model compatible with this UI.

---

**Summary for Claude Code:** Right now, build **Phase 1 only** — Python + Playwright scrapers for Bayut, Dubizzle, and Property Finder, covering Ajman land + commercial units (rent + sale), normalized into the `listings` schema and saved to the database. Start with Bayut, get it fully working, then do the other two. Ask me before starting Phase 2.
