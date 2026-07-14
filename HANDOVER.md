# Intelligent Valuation AI — Handover & Operations Guide

This document explains how to own, run, and maintain the platform. Written for the
person who will operate it after handover. No deep technical background needed for
day-to-day operation.

---

## 1. What the system is

| Piece | What it does | Where it lives |
|---|---|---|
| **Web app** | The dashboard (Overview, Map, Listings, Trends, Insights, AI Assistant, AI Studio) | Vercel — auto-deploys from GitHub `main` |
| **Database** | All scraped listings (~9,000+) and the login accounts | Supabase |
| **Scrapers** | Pull listings from Bayut, Dubizzle, Property Finder | Run on a normal Windows PC (this folder) |
| **Data file** | `webapp/public/landData.json` — the snapshot the website reads | Built by `make_snapshot.py`, published via git |
| **AI assistant** | Gemini-powered chat, grounded in the live data | Vercel serverless function `/api/ask` |

**Valuation method (agreed with the client):**
- **Land**: annual rent = real sale price × yield (5–8%, default 6.5%).
- **Commercial units**: real market rent taken directly from listings. No yield.

---

## 2. Accounts to transfer at handover

1. **GitHub repo** — the code. Transfer: repo Settings → Danger Zone → Transfer ownership.
2. **Vercel project** — the live site. Transfer: Project Settings → Transfer. After
   transfer, set the env var `GEMINI_API_KEY` (new owner's own key from
   https://aistudio.google.com/apikey) and redeploy.
3. **Supabase project** — database + user logins. Invite the new owner
   (Organization → Members) then remove old members. **Rotate the keys afterwards**
   (Settings → API → roll the `sb_secret_` key) and update:
   - the `.env` file on the scrape PC, and
   - the GitHub Action secrets (see section 6).
4. **Gemini key** — never reuse the old personal key; create a fresh one.

## 3. Secret files (NOT in GitHub — hand over separately)

- **`.env`** (this folder) — `SUPABASE_URL`, `SUPABASE_KEY` (the `sb_secret_` writer key).
- **`webapp/.env`** — the publishable Supabase key + `GEMINI_API_KEY` (only needed
  for local development of the site; the live site takes these from Vercel).

Share these via a password manager or in person. Whoever holds `SUPABASE_KEY` can
write to the database.

---

## 4. Refreshing the data — the honest picture

Fresh data comes from scraping the three portals with a real Chrome browser on a
Windows PC. It takes **20–45 minutes**, runs mostly unattended, and **occasionally
Bayut shows a CAPTCHA that a human must click once** (the session is then remembered
for future runs). This is normal for scraping and cannot be fully removed.

### One-time PC setup
1. Install **Python 3.11+** (tick "Add to PATH"), **Google Chrome**, and **Git**.
2. Copy this folder (or `git clone` the repo) and place the `.env` file in it.
3. Double-click **`setup.bat`**. Done.

### To refresh data (one click)
Double-click **`scrape_and_publish.bat`**. It scrapes all 3 portals, rebuilds the
data file, and publishes. The live site updates itself about a minute after it
finishes. If a Chrome window shows a CAPTCHA, solve it — the run continues alone.

### To make it automatic (weekly)
Double-click **`schedule_weekly.bat`** once. Every **Sunday 07:00** the PC runs the
refresh by itself (PC must be ON and logged in). Output is written to
`data\refresh.log`. To change the day/time, edit the `/D` and `/ST` values in that
file and run it again. To turn it off:
`schtasks /Delete /TN "ValuationAI data refresh" /F`

### Free cloud top-up (already configured)
A GitHub Action (`.github/workflows/refresh-propertyfinder.yml`) refreshes
**Property Finder only** every Wednesday in the cloud, for free (it is the one
portal that works without a visible browser). It needs two GitHub repo secrets:
Settings → Secrets and variables → Actions → add `SUPABASE_URL` and `SUPABASE_KEY`.
It can also be run by hand: Actions tab → "Refresh Property Finder data" → Run
workflow.

---

## 5. Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| Chrome opens and shows a puzzle/CAPTCHA | Bayut anti-bot check | Solve it in the window once; the run continues and remembers the session |
| A portal logs `0 hits` on every page | The portal changed its website layout | A developer must update that portal's file in `scrapers/` (usually a 1–2 hour fix). This happens a few times per year — it is expected maintenance, not a defect |
| `Target page, context or browser has been closed` at launch | Two scrapes tried to use the same Chrome profile at once | Wait for the other run to finish, or give the second run its own profile: `set SCRAPE_PROFILE_DIR=.pw-profile-2` |
| `git push` rejected | The PC's GitHub login expired | Re-login with `git push` prompts, or refresh the stored credential in Windows Credential Manager |
| Site shows old data after a refresh | Vercel deploy still running | Wait 1–2 minutes, hard-refresh (Ctrl+Shift+R) |
| AI assistant answers with cards only, no chat | `GEMINI_API_KEY` missing/limit hit in Vercel | Check the env var in Vercel; free-tier Gemini has per-minute limits — it recovers by itself |

### Areas with "no data yet"
Nine districts (Liwara 3, Al Rumailah 3, Mushairef, Al Safia, Mohammed Bin Zayed 1
and 2, Al Raqaib 1 and 2, Al Zahia 2) genuinely have **no listings on any of the
three portals** — verified across full fresh scrapes of all sources. The portals
usually file such listings under a parent name (e.g. "Al Zahya" without a number).
The app states this honestly rather than inventing numbers.

---

## 6. Maintenance expectations (read this)

- **Scrapers break a few times a year** when portals redesign. Budget for a
  developer to fix them (small, contained fixes — each portal is one file in
  `scrapers/`). A monthly maintenance retainer with the original developer is the
  simplest arrangement.
- **Keys**: rotate Supabase keys at handover and once a year.
- **Costs today**: Vercel free tier, Supabase free tier, Gemini free tier, GitHub
  free. The system currently runs at **zero monthly cost**. Heavier AI usage may
  need a paid Gemini key later.

## 7. Useful commands (advanced)

```bash
python run_scrape.py                       # scrape all 3 portals
python run_scrape.py --portal bayut        # one portal only
python run_scrape.py --portal propertyfinder --dry-run   # test without writing
python make_snapshot.py                    # rebuild webapp/public/landData.json
cd webapp && npm install && npm run dev    # run the website locally
```
