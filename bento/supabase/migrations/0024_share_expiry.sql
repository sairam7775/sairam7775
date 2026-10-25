-- Bento · 0024 · optional expiry for companions' links
--
-- NULL keeps today's behaviour: the owner turns the link off or replaces it.
-- A fixed expiry (7 or 30 days) is an instant. "Until the trip ends" is
-- stored as the choice, not a time, so it follows the trip's end date when
-- the dates change: the link works through the last day (UTC, like the
-- database's current_date).
alter table trip_shares add column expires_at timestamptz null;
alter table trip_shares add column until_trip_end boolean not null default false;
alter table trip_shares add constraint trip_shares_one_expiry
  check (not (until_trip_end and expires_at is not null));

-- The existing own-trip-shares policy already checks ownership for every
-- command. Let travellers write only these new columns when creating or
-- changing their own row; the token and trip id stay protected by 0020's grants.
grant insert (expires_at, until_trip_end) on trip_shares to authenticated;
grant update (expires_at, until_trip_end) on trip_shares to authenticated;

-- Expired and unknown tokens both return null, so the public page cannot tell
-- whether a link used to exist. Keep the result shape and grants from 0020.
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
  select tr.* into t from trip_shares s join trips tr on tr.id = s.trip_id
    where s.token = p_token
      and (s.expires_at is null or s.expires_at > now())
      and (not s.until_trip_end or (tr.end_date is not null and now() < (tr.end_date + 1)::timestamp at time zone 'UTC'));
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
