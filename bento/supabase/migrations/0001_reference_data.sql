-- Bento · 0001 · reference data
-- Geography, the curated place database, and the transit graph.
-- All of this is shared, read-only-to-users data. User data lives in 0002.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- enums

create type coverage_tier as enum ('deep', 'outline', 'stub');
create type verification_status as enum ('draft', 'verified');
create type booking_requirement as enum ('none', 'recommended', 'required');

-- The interest taxonomy (D10). Tags answer "what"; the numeric style axes
-- on places and user_preferences answer "how". Both are needed: a flat tag
-- list cannot express "nature but not hiking".
create type interest_tag as enum (
  'shrines', 'food', 'nature', 'art', 'popculture',
  'history', 'shopping', 'nightlife', 'onsen', 'offbeat'
);

-- ------------------------------------------------------- geography

create table regions (
  id          text primary key,              -- 'kansai'
  name        text not null,
  name_ja     text,
  sort_order  int  not null default 0
);

create table prefectures (
  id         text primary key,               -- 'kyoto'
  region_id  text not null references regions (id),
  name       text not null,
  name_ja    text
);

create table cities (
  id             text primary key,           -- 'kyoto-city'
  prefecture_id  text not null references prefectures (id),
  name           text not null,
  name_ja        text,

  -- §06. Passed to the planner so it can decline to plan a city it does
  -- not know well enough, rather than producing a thin itinerary silently.
  coverage_tier  coverage_tier not null default 'stub',

  centroid       extensions.geography(point, 4326),
  transit_note   text,                       -- "Kyoto buses are a trap"

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index cities_coverage_idx on cities (coverage_tier);
create index cities_prefecture_idx on cities (prefecture_id);

-- ------------------------------------------------------- transit graph

create table stations (
  id       text primary key,                 -- 'jr-inari'
  name     text not null,
  name_ja  text,
  city_id  text references cities (id),
  coords   extensions.geography(point, 4326),
  lines    text[] not null default '{}'
);

create index stations_city_idx on stations (city_id);
create index stations_coords_idx on stations using gist (coords);

-- Directed edges. Built from GTFS-JP / ODPT in P3; a whole-Japan
-- origin-destination matrix is infeasible (~9k stations is ~80M pairs),
-- so we store the graph and search it.
create table station_edges (
  from_station  text not null references stations (id),
  to_station    text not null references stations (id),
  line          text not null,
  minutes       int  not null check (minutes >= 0),
  fare_jpy      int,
  service       text,                        -- local | rapid | express | shinkansen
  note          text,                        -- "the Rapid does not stop at Inari"
  primary key (from_station, to_station, line)
);

create index station_edges_from_idx on station_edges (from_station);

-- ------------------------------------------------------- places

create table places (
  id               text primary key,         -- 'kyt-fushimi-inari'
  city_id          text not null references cities (id),
  name             text not null,
  name_ja          text,

  -- Drives the redundancy term: the fourth shrine in a day scores lower
  -- than the first, which is what stops "too many temples" without
  -- anyone having to say it.
  category         text not null,

  coords           extensions.geography(point, 4326),
  nearest_station  text references stations (id),
  station_walk_min int,

  -- ---- scoring inputs (§05 Fig. 1) ----
  interest_tags    interest_tag[] not null default '{}',
  energy           numeric(3,2) check (energy between 0 and 1),
  crowd_level      numeric(3,2) check (crowd_level between 0 and 1),
  discovery        numeric(3,2) check (discovery between 0 and 1),
  signature        numeric(3,2) not null default 0.5 check (signature between 0 and 1),
  physical_demand  numeric(3,2) check (physical_demand between 0 and 1),

  -- ---- judgement fields ----
  -- Never exposed to a traveller while verification_status = 'draft'.
  -- Enforced by the places_public view in 0003, not by convention.
  duration_taste_min    int,
  duration_typical_min  int,
  duration_full_min     int,
  best_window           text[],
  crowd_note            text,
  worth_it_if           text[],
  skip_if               text[],
  local_tip             text,

  -- ---- facts ----
  cost_jpy          int,
  booking_req       booking_requirement not null default 'none',
  booking_lead_days int,
  opens_at          time,
  closes_at         time,
  closed_weekdays   int[] not null default '{}',   -- 0 = Sunday
  closed_dates      date[] not null default '{}',

  conflicts_with    text[] not null default '{}',  -- opposite ends of a city
  pairs_with        text[] not null default '{}',

  -- ---- provenance: the honesty gate (§10) ----
  verification_status verification_status not null default 'draft',
  verified_by         text,
  last_verified       date,
  sources             text[] not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A record cannot claim to be verified without saying by whom and when.
  constraint verified_records_have_provenance check (
    verification_status = 'draft'
    or (verified_by is not null and last_verified is not null)
  )
);

create index places_city_idx on places (city_id);
create index places_tags_idx on places using gin (interest_tags);
create index places_verified_idx on places (verification_status);
create index places_coords_idx on places using gist (coords);

-- ------------------------------------------------------- fx

-- Every cost in this database is stored in JPY. Conversion happens on read
-- so a stale rate can never be silently baked into stored data.
create table fx_rates (
  currency      text primary key,            -- ISO 4217
  jpy_per_unit  numeric(14,6) not null,
  fetched_at    timestamptz not null default now()
);

-- ------------------------------------------------------- calendar

create table calendar_notes (
  date      date primary key,
  label     text not null,                   -- 'Golden Week', 'Obon'
  kind      text not null,                   -- holiday | peak | festival
  note      text
);
