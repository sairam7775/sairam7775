-- A stop the traveller names that isn't one of Bento's places ("Add a
-- place" on the day box, typed by hand: a friend's restaurant, a shop).
-- Bento can't check its hours or the travel to it, and says so; it keeps
-- the name and the length the traveller gave.
--
-- itinerary_items.place_id was already nullable (0002). A free-text stop
-- has place_id null and custom_name set; a Bento stop the other way round.
--
-- What this changes:
--   1. itinerary_items: a custom_name column and its checks.
--   2. replace_day_items: writes custom_name, and an empty place_id as null.
--   3. shared_trip: each stop carries its custom_name, so the shared sheet
--      can name it.
--   4. trip_reviews_plan: the saved plan names a free-text stop by its name.
--
-- What it doesn't change: apply_proposal's stale-day check (0031). It
-- compares place_id, which is null for a free-text stop, and the app's
-- dayBase sends placeId null for one too, so the two sides agree. It does
-- not compare the free-text name: two free-text stops swapped for each
-- other at the same slot, time and length would read as the same day.
--
-- RLS: the existing "own itinerary_items" policy covers the new column.
-- Limits: the row cap (60 stops a day) and the write allowance triggers
-- (0029) are on the table, so they cover these rows too; the length check
-- below bounds what one name can cost.
--
-- Release order: this migration before the code that selects custom_name
-- (store.supabase.ts loadState); a named column the database doesn't have
-- fails the whole read. Code that only writes it is safe either way: the
-- old replace_day_items ignores the key, and a free-text stop then fails
-- on place_id's foreign key, so nothing half-saved.

alter table itinerary_items
  add column custom_name text;

alter table itinerary_items
  add constraint itinerary_items_custom_name_shape check (
    custom_name is null
    or (char_length(custom_name) between 1 and 80
        and btrim(custom_name) = custom_name
        and custom_name !~ '[[:cntrl:]]')
  ),
  -- One kind of stop: a Bento place or a name, never both.
  add constraint itinerary_items_one_kind check (custom_name is null or place_id is null),
  -- A free-text stop always has the length the traveller gave: Bento has
  -- no record to take one from. Five minutes to twelve hours.
  add constraint itinerary_items_custom_duration check (custom_name is null or duration_min between 5 and 720);

-- Every stop is something. NOT VALID: rows written before this (place_id
-- null through a direct API call) are left alone; new and changed rows
-- are checked. Validate it once a read shows none:
--   select count(*) from itinerary_items where place_id is null and custom_name is null;
--   alter table itinerary_items validate constraint itinerary_items_is_a_stop;
alter table itinerary_items
  add constraint itinerary_items_is_a_stop check (place_id is not null or custom_name is not null) not valid;

-- Hand edits write custom_name too. Same signature, return type, lock and
-- security as 0031, so its grants stay.
create or replace function replace_day_items(p_trip uuid, p_date date, p_city text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day uuid;
begin
  perform 1 from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;
  insert into itinerary_days (trip_id, date, city_id)
  values (p_trip, p_date, p_city)
  on conflict (trip_id, date) do update set city_id = excluded.city_id
  returning id into v_day;

  delete from itinerary_items where day_id = v_day;
  insert into itinerary_items (day_id, place_id, custom_name, sort_order, start_time, duration_min, locked, reason, reason_terms, arrive_mode, arrive_minutes, arrive_detail)
  select
    v_day,
    nullif(i->>'place_id', ''),
    nullif(i->>'custom_name', ''),
    (i->>'sort_order')::int,
    nullif(i->>'start_time', '')::time,
    nullif(i->>'duration_min', '')::int,
    coalesce((i->>'locked')::boolean, false),
    nullif(i->>'reason', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(i->'reason_terms', '[]'::jsonb))), '{}'),
    nullif(i->>'arrive_mode', ''),
    nullif(i->>'arrive_minutes', '')::int,
    nullif(i->>'arrive_detail', '')
  from jsonb_array_elements(p_items) i;
  return v_day;
end;
$$;

-- The shared sheet names a free-text stop. Only change from 0026:
-- 'custom_name' on each item.
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
            'id', i.id, 'place_id', i.place_id, 'custom_name', i.custom_name, 'sort_order', i.sort_order, 'start_time', i.start_time,
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

-- The plan saved with a trip review names a free-text stop by its name,
-- not "?". Only change from 0019: i.custom_name in the stop's name.
create or replace function trip_reviews_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.trip_id    := old.trip_id;
    new.plan       := old.plan;
    new.created_at := old.created_at;
  else
  new.plan := jsonb_build_object(
    'start', (select start_date from trips where id = new.trip_id),
    'end',   (select end_date from trips where id = new.trip_id),
    'party', (select party_size from trips where id = new.trip_id),
    'route', coalesce((
      select jsonb_agg(jsonb_build_object('city', coalesce(c.name, tc.city_id), 'nights', tc.nights) order by tc.sort_order)
      from trip_cities tc left join cities c on c.id = tc.city_id
      where tc.trip_id = new.trip_id), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.date,
        'city', coalesce(c.name, d.city_id),
        'stops', coalesce((
          select jsonb_agg(jsonb_build_object('time', left(i.start_time::text, 5), 'name', coalesce(p.name, i.custom_name, i.place_id, '?')) order by i.sort_order)
          from itinerary_items i left join places_public p on p.id = i.place_id
          where i.day_id = d.id), '[]'::jsonb)
      ) order by d.date)
      from itinerary_days d left join cities c on c.id = d.city_id
      where d.trip_id = new.trip_id), '[]'::jsonb)
  );
  end if;
  -- Hard days are days of the saved plan: inside its dates, or the admin
  -- page couldn't place them. (The app checks first; this is the backstop
  -- for a direct API call or a trip edited in another tab meanwhile.)
  if exists (
    select 1 from unnest(new.hard_days) h
    where new.plan->>'start' is null or new.plan->>'end' is null
       or h < (new.plan->>'start')::date or h > (new.plan->>'end')::date
  ) then
    raise exception 'hard days must be inside the trip''s dates' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
