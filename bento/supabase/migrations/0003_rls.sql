-- Bento · 0003 · row-level security, the verification gate, and grants
--
-- Two rules govern this file:
--   1. A user can only ever see their own trip data.
--   2. A drafted judgement field is never visible to a traveller.
-- Both are enforced in the database, not by application convention.

-- ================================================================
-- Reference data — readable by any signed-in user, writable by none.
-- Curation happens through the service role (the admin UI in P2).
-- ================================================================

alter table regions        enable row level security;
alter table prefectures    enable row level security;
alter table cities         enable row level security;
alter table stations       enable row level security;
alter table station_edges  enable row level security;
alter table places         enable row level security;
alter table fx_rates       enable row level security;
alter table calendar_notes enable row level security;

create policy "regions readable"        on regions        for select to authenticated using (true);
create policy "prefectures readable"    on prefectures    for select to authenticated using (true);
create policy "cities readable"         on cities         for select to authenticated using (true);
create policy "stations readable"       on stations       for select to authenticated using (true);
create policy "station_edges readable"  on station_edges  for select to authenticated using (true);
create policy "fx_rates readable"       on fx_rates       for select to authenticated using (true);
create policy "calendar_notes readable" on calendar_notes for select to authenticated using (true);

-- No select policy on `places` is created on purpose. Users read the
-- view below instead, which strips unverified judgement fields.

-- ================================================================
-- The verification gate (§10)
--
-- Factual fields are safe to show as soon as they are imported. Judgement
-- fields — how long it really takes, when to go, who should skip it — are
-- exactly where a drafted guess would do damage, so they read as NULL
-- until a human has signed the record off.
--
-- This view is security definer (Postgres default), so it reads `places`
-- past that table's RLS while users hold no direct grant on it.
-- ================================================================

create view places_public as
select
  p.id,
  p.city_id,
  p.name,
  p.name_ja,
  p.category,
  p.coords,
  p.nearest_station,
  p.station_walk_min,

  p.interest_tags,
  p.energy,
  p.crowd_level,
  p.discovery,
  p.signature,
  p.physical_demand,

  -- Judgement fields: visible only when verified.
  case when p.verification_status = 'verified' then p.duration_taste_min   end as duration_taste_min,
  case when p.verification_status = 'verified' then p.duration_typical_min end as duration_typical_min,
  case when p.verification_status = 'verified' then p.duration_full_min    end as duration_full_min,
  case when p.verification_status = 'verified' then p.best_window          end as best_window,
  case when p.verification_status = 'verified' then p.crowd_note           end as crowd_note,
  case when p.verification_status = 'verified' then p.worth_it_if          end as worth_it_if,
  case when p.verification_status = 'verified' then p.skip_if              end as skip_if,
  case when p.verification_status = 'verified' then p.local_tip            end as local_tip,

  p.cost_jpy,
  p.booking_req,
  p.booking_lead_days,
  p.opens_at,
  p.closes_at,
  p.closed_weekdays,
  p.closed_dates,
  p.conflicts_with,
  p.pairs_with,

  -- Shown in the interface. Staleness is information, not something to hide.
  p.verification_status,
  p.last_verified,
  p.sources
from places p;

revoke all on places from anon, authenticated;
grant select on places_public to authenticated;

-- ================================================================
-- User data — owner only, on every table.
-- ================================================================

alter table user_preferences enable row level security;
alter table trips            enable row level security;
alter table trip_cities      enable row level security;
alter table itinerary_days   enable row level security;
alter table itinerary_items  enable row level security;
alter table bookings         enable row level security;
alter table chat_messages    enable row level security;
alter table api_usage        enable row level security;

create policy "own preferences" on user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own trips" on trips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Children are reached through their trip, so ownership is one join away.
create policy "own trip_cities" on trip_cities
  for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "own itinerary_days" on itinerary_days
  for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "own itinerary_items" on itinerary_items
  for all to authenticated
  using (exists (
    select 1 from itinerary_days d join trips t on t.id = d.trip_id
    where d.id = day_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from itinerary_days d join trips t on t.id = d.trip_id
    where d.id = day_id and t.user_id = (select auth.uid())));

create policy "own bookings" on bookings
  for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "own chat_messages" on chat_messages
  for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

-- Usage is readable by its owner so the app can show spend, but only the
-- server (service role) may write it — a client that could write its own
-- usage rows could also under-report them.
create policy "read own usage" on api_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ================================================================
-- New users get a preferences row, so the app never has to handle
-- "signed in but no profile".
-- ================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
