-- Ajman Land Intelligence Platform — Phase 1 schema
-- Run once in Supabase (SQL editor) or: psql "$DATABASE_URL" -f db/schema.sql

-- 47 Ajman areas (seeded from scrapers/areas.py via db.client.seed_areas)
create table if not exists areas (
    area_key text primary key,
    name_en  text not null,
    name_ar  text
);

-- one row per scraped listing; de-duplicated on source_url
create table if not exists listings (
    id             bigserial primary key,
    source         text not null,            -- 'bayut' | 'dubizzle' | 'propertyfinder'
    source_url     text unique not null,     -- upsert key
    listing_type   text,                     -- 'rent' | 'sale'
    category       text,                     -- 'land' | 'commercial_unit'
    subtype        text,                     -- 'commercial_land','office','warehouse', ...
    area_key       text references areas(area_key),
    area_raw       text,                     -- original location text from the site
    emirate        text default 'Ajman',
    price          numeric,                  -- AED
    price_period   text,                     -- 'year' | 'total'
    size_sqft      numeric,
    price_per_sqft numeric,                  -- price / size_sqft
    beds           int,
    baths          int,
    title          text,
    listed_date    date,
    scraped_at     timestamptz default now(),
    raw            jsonb
);

create index if not exists idx_listings_area    on listings (area_key);
create index if not exists idx_listings_source  on listings (source);
create index if not exists idx_listings_type    on listings (listing_type, category);
create index if not exists idx_listings_scraped on listings (scraped_at);
