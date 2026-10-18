-- Bento · 0020 · sharing a trip with the people travelling
--
-- A traveller can give their companions a link to the plan. Anyone with the
-- link can read it, no account needed, until the traveller switches it off
-- or replaces it. The link's token is its only key, so it is long (32 hex
-- characters, 122 random bits from gen_random_uuid) and made here, never by
-- a client.
--
-- What a link shows comes from shared_trip() alone: the route, every day's
-- stops with the facts the plan shows, and booking names and times. Never a
-- booking reference, note, cost or provider, and never who the traveller
-- is. Places and stations stay closed to anon (0010): only the places in
-- this one plan go out, through places_public, so nothing unverified does.

create table trip_shares (
  trip_id     uuid primary key references trips (id) on delete cascade,
  token       text not null unique
              default replace(gen_random_uuid()::text, '-', '')
              check (token ~ '^[0-9a-f]{32}$'),
  created_at  timestamptz not null default now()
);

alter table trip_shares enable row level security;

create policy "own trip shares" on trip_shares for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

-- Supabase's default privileges grant everything on a new table. A traveller
-- names the trip and nothing else: the token comes from the default. A new
-- link is a delete and an insert, so there is no update.
revoke all on trip_shares from anon, authenticated;
grant select, delete on trip_shares to authenticated;
grant insert (trip_id) on trip_shares to authenticated;

-- The plan behind a link, or null if no trip is shared under that token.
-- Definer rights: the visitor may have no account. Shaped for
-- lib/trips/shared-plan.ts SharedPlanSchema. Times as stored: booking times
-- are wall-clock written as if UTC, so the function reads them in UTC.
create or replace function shared_trip(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set timezone = 'UTC'
as $$
declare
  t trips;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select tr.* into t from trip_shares s join trips tr on tr.id = s.trip_id where s.token = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'trip', jsonb_build_object(
      'id', t.id, 'title', t.title, 'start_date', t.start_date, 'end_date', t.end_date,
      'party_size', t.party_size, 'status', t.status),
    -- Only the pace: the lunch break is placed by it, as on the trip page.
    'pace', (select p.pace from user_preferences p where p.user_id = t.user_id),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'city_id', tc.city_id, 'name', c.name, 'tier', c.coverage_tier, 'nights', tc.nights,
        'sort_order', tc.sort_order, 'arrive_date', tc.arrive_date, 'depart_date', tc.depart_date) order by tc.sort_order)
      from trip_cities tc left join cities c on c.id = tc.city_id
      where tc.trip_id = t.id), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'date', d.date, 'city_id', d.city_id,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'place_id', i.place_id, 'sort_order', i.sort_order, 'start_time', i.start_time,
            'duration_min', i.duration_min, 'reason', i.reason, 'arrive_mode', i.arrive_mode,
            'arrive_minutes', i.arrive_minutes, 'arrive_detail', i.arrive_detail) order by i.sort_order)
          from itinerary_items i where i.day_id = d.id), '[]'::jsonb)) order by d.date)
      from itinerary_days d
      where d.trip_id = t.id), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'nearest_station', p.nearest_station, 'station_walk_min', p.station_walk_min,
        'opens_at', p.opens_at, 'closes_at', p.closes_at, 'crowd_note', p.crowd_note, 'local_tip', p.local_tip))
      from places_public p
      where p.id in (select i.place_id from itinerary_items i join itinerary_days d on d.id = i.day_id where d.trip_id = t.id)), '[]'::jsonb),
    'stations', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name))
      from stations st
      where st.id in (
        select p.nearest_station from places_public p
        where p.id in (select i.place_id from itinerary_items i join itinerary_days d on d.id = i.day_id where d.trip_id = t.id))), '[]'::jsonb),
    -- Never reference, notes, cost or provider.
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'type', b.type, 'title', b.title, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'starts_time_known', b.starts_time_known, 'ends_time_known', b.ends_time_known, 'planned_on', b.planned_on))
      from bookings b
      where b.trip_id = t.id), '[]'::jsonb)
  );
end;
$$;

revoke all on function shared_trip(text) from public;
grant execute on function shared_trip(text) to anon, authenticated;
