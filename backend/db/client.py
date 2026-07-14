"""Supabase connection + idempotent upserts.

Reads SUPABASE_URL / SUPABASE_KEY from the environment (.env). Use the SERVICE
ROLE key here — this is a trusted backend writer that must bypass RLS.
"""
from __future__ import annotations

import json
import logging
import os

from dotenv import load_dotenv
from supabase import Client, create_client

from scrapers.areas import AREAS

load_dotenv()
log = logging.getLogger("db")


def get_client() -> Client:
    try:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
    except KeyError as exc:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env") from exc
    return create_client(url, key)


def seed_areas(client: Client | None = None) -> int:
    """Upsert the 47 areas. Idempotent."""
    client = client or get_client()
    rows = [{"area_key": k, "name_en": v["en"], "name_ar": v.get("ar")} for k, v in AREAS.items()]
    client.table("areas").upsert(rows, on_conflict="area_key").execute()
    log.info("seeded %d areas", len(rows))
    return len(rows)


def _clean(row: dict) -> dict:
    """Ensure the jsonb `raw` field is JSON-serialisable."""
    r = dict(row)
    raw = r.get("raw")
    if raw is not None and not isinstance(raw, str):
        r["raw"] = json.loads(json.dumps(raw, default=str))
    return r


def upsert_listings(rows: list[dict], client: Client | None = None, batch: int = 200) -> int:
    """Upsert listings on source_url (re-runs update existing rows, no duplicates)."""
    rows = [_clean(r) for r in rows if r.get("source_url")]
    if not rows:
        return 0
    client = client or get_client()
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        client.table("listings").upsert(chunk, on_conflict="source_url").execute()
        total += len(chunk)
    log.info("upserted %d listings", total)
    return total
