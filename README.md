# E-Rent AI — Ajman Land Intelligence (Phase 1: Scrapers)

Python + Playwright scrapers that pull **rent + sale** listings for **land** and
**commercial units** across all 47 Ajman areas from **Bayut, Dubizzle, and
Property Finder**, normalize them, and upsert into **Supabase**.

> Scope: this repo is **Phase 1 only** (scraping → DB). API (FastAPI) and the
> Next.js UI come later. See [CLAUDE.md](CLAUDE.md) for the full plan.

## Project layout
```
scrapers/
  base.py          # Playwright browser, delays, proxy, retries, JSON helper
  areas.py         # the 47 areas + messy-location -> area_key matcher
  normalize.py     # clean fields -> `listings` schema
  bayut.py         # (built after recon) Bayut scraper
  dubizzle.py      # (later)
  propertyfinder.py# (later)
db/
  schema.sql       # tables: areas, listings
  client.py        # Supabase connection + idempotent upserts
run_scrape.py      # entrypoint: run portals, report counts
```

## Setup
```bash
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
playwright install chromium

cp .env.example .env        # then fill in SUPABASE_URL / SUPABASE_KEY
```

## Database
1. Create the tables: run `db/schema.sql` in the Supabase SQL editor
   (or `psql "$DATABASE_URL" -f db/schema.sql`).
2. Seed the areas: `python run_scrape.py --seed-areas`

## Run
```bash
python run_scrape.py --portal bayut --dry-run   # test without writing
python run_scrape.py --portal bayut             # write to Supabase
python run_scrape.py                            # all available portals
```

## Conventions
- Idempotent: upsert on `source_url`, re-runs update rather than duplicate.
- Be polite: random 2–6s delays, low concurrency, stop if blocked.
- Secrets live only in `.env` (never committed). Scraped data in `data/` is gitignored.
- Keep each portal's selectors/endpoints isolated in its own file.
