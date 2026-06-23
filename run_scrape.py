"""Entry point: run the portal scrapers and report counts.

Usage:
    python run_scrape.py --seed-areas          # seed the 47 areas, then exit
    python run_scrape.py --portal bayut        # one portal
    python run_scrape.py                       # all available portals
    python run_scrape.py --dry-run             # scrape but don't write to DB
"""
from __future__ import annotations

import argparse
import logging
import sys

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run")

# Register scrapers as they become available. Missing ones are skipped (not yet built).
PORTALS: dict[str, type] = {}
for name, module, cls in [
    ("bayut", "scrapers.bayut", "BayutScraper"),
    ("dubizzle", "scrapers.dubizzle", "DubizzleScraper"),
    ("propertyfinder", "scrapers.propertyfinder", "PropertyFinderScraper"),
]:
    try:
        PORTALS[name] = getattr(__import__(module, fromlist=[cls]), cls)
    except Exception as exc:  # noqa: BLE001
        log.debug("scraper %s not available yet (%s)", name, exc)


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape Ajman property portals -> Supabase")
    ap.add_argument("--portal", choices=list(PORTALS) + ["all"], default="all")
    ap.add_argument("--seed-areas", action="store_true", help="seed the areas table then exit")
    ap.add_argument("--dry-run", action="store_true", help="scrape but do not write to the DB")
    args = ap.parse_args()

    if args.seed_areas:
        from db.client import seed_areas
        seed_areas()
        return

    targets = list(PORTALS) if args.portal == "all" else [args.portal]
    if not targets:
        log.error("No scrapers are available yet. Build scrapers/bayut.py first.")
        sys.exit(1)

    totals: dict[str, int] = {}
    for name in targets:
        log.info("=== scraping %s ===", name)
        try:
            rows = PORTALS[name]().run(dry_run=args.dry_run)
            totals[name] = len(rows)
        except Exception as exc:  # noqa: BLE001
            log.exception("%s failed: %s", name, exc)
            totals[name] = 0

    log.info("DONE — %s", ", ".join(f"{k}: {v} listings" for k, v in totals.items()) or "nothing scraped")


if __name__ == "__main__":
    main()
