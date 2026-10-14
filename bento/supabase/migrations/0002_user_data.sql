-- Bento · 0002 · user data
-- Everything here is owned by exactly one user and isolated by RLS (0003).

create type travel_pace as enum ('relaxed', 'standard', 'packed');
create type budget_band as enum ('budget', 'mid', 'comfortable');
create type trip_status as enum ('planning', 'booked', 'travelling', 'done', 'abandoned');
create type booking_type as enum (
  'flight', 'accommodation', 'transport', 'activity', 'restaurant', 'other'
);
create type chat_role as enum ('user', 'assistant');

-- ------------------------------------------------------- preferences

-- Visible and editable by the user. Preferences are never inferred
-- silently — if Bento Man learns something, it goes here where it can
-- be read and corrected.
create table user_preferences (
  user_id          uuid primary key references auth.users (id) on delete cascade,

  pace             travel_pace not null default 'standard',
  interest_tags    interest_tag[] not null default '{}',

  -- Style axes (D10). energy separates gardens from mountain trails;
  -- crowd_tolerance decides whether the scheduler anchors early mornings.
  energy           numeric(3,2) not null default 0.5 check (energy between 0 and 1),
  crowd_tolerance  numeric(3,2) not null default 0.5 check (crowd_tolerance between 0 and 1),
  discovery        numeric(3,2) not null default 0.5 check (discovery between 0 and 1),

  -- Hard filter, not a scoring penalty. "No beaches" means never.
  -- Applied at scheduler step 2, before anything is scored.
  excludes         text[] not null default '{}',

  mobility         text[] not null default '{}',
  dietary          text[] not null default '{}',
  display_currency text not null default 'JPY',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------- trips

create table trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  start_date  date,
  end_date    date,
  party_size  int not null default 1 check (party_size > 0),
  status      trip_status not null default 'planning',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint trip_dates_ordered check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create index trips_user_idx on trips (user_id);

create table trip_cities (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  city_id     text not null references cities (id),
  nights      int  not null check (nights >= 0),
  arrive_date date,
  depart_date date,
  sort_order  int  not null default 0,

  -- D14: budget is per city, not per trip. A ryokan night in Hakone must
  -- not make the Tokyo days score as overspending.
  budget_band budget_band,

  reason      text,                          -- why this city, in the plan
  unique (trip_id, city_id)
);

create index trip_cities_trip_idx on trip_cities (trip_id);

-- ------------------------------------------------------- itinerary

create table itinerary_days (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references trips (id) on delete cascade,
  city_id  text references cities (id),
  date     date not null,
  note     text,
  unique (trip_id, date)
);

create index itinerary_days_trip_idx on itinerary_days (trip_id);

create table itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references itinerary_days (id) on delete cascade,
  place_id      text references places (id),
  sort_order    int  not null default 0,
  start_time    time,
  duration_min  int,

  -- The two fields that carry the whole feedback design (§08).
  -- locked survives re-planning; the scheduler treats it as fixed.
  locked        boolean not null default false,
  -- reason is assembled from the scoring terms that actually moved the
  -- score, so it is true by construction rather than written after.
  reason        text,
  reason_terms  text[] not null default '{}',

  -- How the traveller gets here from the previous stop.
  arrive_mode    text,
  arrive_minutes int,
  arrive_detail  text,

  created_at  timestamptz not null default now()
);

create index itinerary_items_day_idx on itinerary_items (day_id, sort_order);

-- ------------------------------------------------------- bookings

-- Only ever what the traveller uploads. Nothing is fetched from airline
-- or hotel sites: no OAuth, no scraping, and a much smaller blast radius.
create table bookings (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references trips (id) on delete cascade,
  type      booking_type not null,
  title     text not null,
  provider  text,

  -- A PNR plus a surname can be enough to cancel someone's flight.
  -- Encrypted at rest, never logged, never placed in a model prompt.
  reference_encrypted text,

  starts_at timestamptz,
  ends_at   timestamptz,
  city_id   text references cities (id),

  cost_jpy      int,
  cost_currency text,
  cost_amount   numeric(12,2),

  file_path text,                            -- per-user storage bucket path
  covers_day_id uuid references itinerary_days (id) on delete set null,
  notes     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_trip_idx on bookings (trip_id);
create index bookings_type_idx on bookings (trip_id, type);

-- ------------------------------------------------------- chat

create table chat_messages (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references trips (id) on delete cascade,
  role      chat_role not null,
  content   text not null,
  -- The engine's proposed change, awaiting accept/reject. The model never
  -- writes the itinerary directly.
  proposed_diff jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_trip_idx on chat_messages (trip_id, created_at);

-- ------------------------------------------------------- spend control

-- Risk E2: an uncapped bill on a personal card is the fastest way this
-- project hurts its owner. Usage is recorded on every model call and
-- checked before the next one.
create table api_usage (
  id            bigserial primary key,
  user_id       uuid references auth.users (id) on delete cascade,
  kind          text not null,               -- chat | parse | draft
  model         text,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cached_tokens int  not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  created_at    timestamptz not null default now()
);

create index api_usage_user_month_idx on api_usage (user_id, created_at desc);

-- Month-to-date spend for one user, in USD.
create or replace function month_to_date_spend(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0)
  from api_usage
  where user_id = p_user
    and created_at >= date_trunc('month', now());
$$;

-- ------------------------------------------------------- touch triggers

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_touch before update on trips
  for each row execute function touch_updated_at();
create trigger bookings_touch before update on bookings
  for each row execute function touch_updated_at();
create trigger user_preferences_touch before update on user_preferences
  for each row execute function touch_updated_at();
create trigger places_touch before update on places
  for each row execute function touch_updated_at();
create trigger cities_touch before update on cities
  for each row execute function touch_updated_at();
