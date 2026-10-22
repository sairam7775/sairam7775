-- Bento · 0026 · seasonal hours are never promised
--
-- Opening hours that change with the season are too many to keep exact, so
-- a place with seasonal hours stores the SHORTEST hours of its year in
-- opens_at / closes_at (the planner then never sends anyone after closing)
-- and says so with hours_vary. Travellers read "usually open … hours change
-- with the season, check before you go", never a promise.

alter table places add column hours_vary boolean not null default false;

comment on column places.hours_vary is
  'True when opens_at/closes_at are the shortest hours of a seasonal schedule.';

-- Appending a column to the view keeps every existing consumer working.
create or replace view places_public
with (security_invoker = false) as
select
  p.id, p.city_id, p.name, p.name_ja, p.category, p.coords, p.nearest_station, p.station_walk_min,
  p.interest_tags, p.energy, p.crowd_level, p.discovery, p.signature, p.physical_demand,
  case when p.verification_status = 'verified' then p.duration_taste_min   end as duration_taste_min,
  case when p.verification_status = 'verified' then p.duration_typical_min end as duration_typical_min,
  case when p.verification_status = 'verified' then p.duration_full_min    end as duration_full_min,
  case when p.verification_status = 'verified' then p.best_window          end as best_window,
  case when p.verification_status = 'verified' then p.crowd_note           end as crowd_note,
  case when p.verification_status = 'verified' then p.worth_it_if          end as worth_it_if,
  case when p.verification_status = 'verified' then p.skip_if              end as skip_if,
  case when p.verification_status = 'verified' then p.local_tip            end as local_tip,
  p.cost_jpy, p.booking_req, p.booking_lead_days, p.opens_at, p.closes_at, p.closed_weekdays, p.closed_dates,
  p.conflicts_with, p.pairs_with,
  p.verification_status, p.last_verified, p.sources,
  p.seasons,
  p.hours_vary
from places p;

-- 0013's lock, again: the view must stay read-only.
revoke insert, update, delete, truncate, references, trigger
  on public.places_public
  from anon, authenticated;

-- The shared sheet says when hours vary, as the trip page's download does.
-- Only change from 0024: 'hours_vary' on each place.
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
        'opens_at', p.opens_at, 'closes_at', p.closes_at, 'hours_vary', p.hours_vary,
        'crowd_note', p.crowd_note, 'local_tip', p.local_tip))
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
