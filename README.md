# Intelligent Valuation AI

Real estate valuation intelligence for Ajman (UAE). The platform scrapes live land
and commercial listings from **Bayut, Dubizzle and Property Finder**, stores them in
a database, and presents rents, prices, trends and AI insights in a bilingual
(EN/AR) dashboard used by the Land Management Department.

**Live site:** https://e-rent-ai.vercel.app

---

## Project structure

```
├── frontend/              The website (Vite + React) — deployed on Vercel
│   ├── src/               Pages, components, styles
│   ├── api/               Serverless function for the Gemini AI assistant
│   └── public/            Static assets + landData.json (the data snapshot)
│
├── backend/               The data engine (Python)
│   ├── scrapers/          One scraper per portal + area matcher + normaliser
│   ├── db/                Supabase client + database schema
│   ├── run_scrape.py      Scrape all 3 portals → Supabase
│   ├── make_snapshot.py   Supabase → frontend/public/landData.json
│   └── requirements.txt   Python dependencies
│
├── docs/                  HANDOVER.md (operations guide) + project guide PDF
├── extras/                Optional add-ons (password reset page)
├── setup.bat              One-time PC setup (installs everything)
├── scrape_and_publish.bat ONE CLICK: scrape → rebuild → publish to live site
├── schedule_weekly.bat    Turn on the automatic weekly refresh
└── .github/workflows/     Free weekly Property Finder refresh in the cloud
```

## How data flows

```
Bayut / Dubizzle / Property Finder
        │  (scrape_and_publish.bat — real Chrome, 20–45 min)
        ▼
     Supabase  (all listings, deduplicated by URL)
        │  (make_snapshot.py)
        ▼
frontend/public/landData.json
        │  (git push)
        ▼
   Vercel auto-deploys → live dashboard updates
```

## Valuation methodology

- **Land**: annual rent = real sale price × yield (5–8%, default 6.5%).
- **Commercial units**: real market rent taken directly from listings — no yield.
- Coverage: 54 Ajman areas (the client's 47 districts + 7 portal areas). Areas with
  no portal listings honestly show "no data yet".

## Quick start

- **Refresh the data (one click):** double-click `scrape_and_publish.bat`.
- **Make it automatic:** double-click `schedule_weekly.bat` (Sundays 07:00).
- **Run the website locally:** `cd frontend && npm install && npm run dev`
- **New PC setup:** install Python 3.11+, Chrome, Git → place `.env` in the project
  root → double-click `setup.bat`.

Secrets live in `.env` (project root) and `frontend/.env` — both gitignored, never
committed. See **[docs/HANDOVER.md](docs/HANDOVER.md)** for the full operations and
handover guide, and **docs/** for the complete project guide PDF.
