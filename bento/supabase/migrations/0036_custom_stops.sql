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
--   5. day_base: the day as saved, as a proposal's base records it, with a
--      free-text stop's name as customName. apply_proposal (0031's, with
--      only its base query moved into day_base) compares against it, so
--      free-text stops are told apart. diff.ts dayBase builds the same.
--   6. replace_day_items_checked: a hand edit worked out from the day as
--      read ("Add a place") is written only if the day is still that,
--      under the trip lock; otherwise 'stale_day' and nothing written.
--      Every other hand edit still calls replace_day_items unchecked.
--
-- Two connections at once are not exercised by any test here.
--
-- RLS: the existing "own itinerary_items" policy covers the new column.
-- Limits: the row cap (60 stops a day) and the write allowance triggers
-- (0029) are on the table, so they cover these rows too; the length check
-- below bounds what one name can cost.
--
-- Release order: this migration before the code that selects custom_name
-- (store.supabase.ts loadState); a named column the database doesn't have
-- fails the whole read, and the code that calls replace_day_items_checked
-- fails without it ("Couldn't add it"). Code that only writes custom_name
-- is safe either way: the old replace_day_items ignores the key, and a
-- free-text stop then fails on place_id's foreign key, so nothing
-- half-saved.

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
  add constraint itinerary_items_custom_duration check (custom_name is null or (duration_min is not null and duration_min between 5 and 720));

-- Every stop is something. NOT VALID: rows written before this (place_id
-- null through a direct API call) are left alone; new and changed rows
-- are checked. Validate it once a read shows none:
--   select count(*) from itinerary_items where place_id is null and custom_name is null;
--   alter table itinerary_items validate constraint itinerary_items_is_a_stop;
alter table itinerary_items
  add constraint itinerary_items_is_a_stop check (place_id is not null or custom_name is not null) not valid;

-- ------------------------------------------------------------ day_base
-- The day as saved, as a proposal's `base` records it (diff.ts dayBase):
-- one total order over every compared field, the same in both. A free-text
-- stop carries its name as customName, so two of them at the same slot are
-- told apart (place_id is null for both). Only such a stop has the key, so
-- a base stored before this (no free-text stops then) still matches a day
-- of Bento stops exactly as 0031 built it.
create or replace function day_base(p_trip uuid, p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'placeId', i.place_id, 'sortOrder', i.sort_order, 'locked', i.locked,
             'startMin', (extract(hour from i.start_time) * 60 + extract(minute from i.start_time))::int,
             'durationMin', i.duration_min, 'arriveMode', i.arrive_mode,
             'arriveMinutes', i.arrive_minutes, 'arriveDetail', i.arrive_detail)
           || case when i.custom_name is not null then jsonb_build_object('customName', i.custom_name) else '{}'::jsonb end
         order by i.sort_order,
                  i.place_id collate "C" nulls last,
                  i.custom_name collate "C" nulls last,
                  (extract(hour from i.start_time) * 60 + extract(minute from i.start_time))::int nulls last,
                  i.duration_min nulls last,
                  i.locked,
                  i.arrive_mode collate "C" nulls last,
                  i.arrive_minutes nulls last,
                  i.arrive_detail collate "C" nulls last), '[]'::jsonb)
  from itinerary_items i join itinerary_days d on d.id = i.day_id
  where d.trip_id = p_trip and d.date = p_date;
$$;

revoke all on function day_base(uuid, date) from public, anon;
grant execute on function day_base(uuid, date) to authenticated, service_role;

-- 0031's apply_proposal, comparing against day_base. Only change: the base
-- is built by day_base. Same signature and return type, so its grants stay.
create or replace function apply_proposal(
  p_trip         uuid,
  p_message      uuid,
  p_route        jsonb,
  p_days         jsonb,
  p_expect_start date,
  p_expect_end   date
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_day  jsonb;
  v_base jsonb;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;

  -- Lock the message too, so a concurrent Reject queues behind this.
  perform 1 from chat_messages
   where id = p_message and trip_id = p_trip and diff_status = 'proposed'
   for update;
  if not found then
    raise exception 'proposal already answered';
  end if;

  -- Check every base before the route replacement can delete a day.
  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    if v_day ? 'base' then
      -- The day as saved now, in day_base's total order (0036).
      v_base := day_base(p_trip, (v_day->>'date')::date);
      if v_base is distinct from v_day->'base' then
        update chat_messages
           set diff_status = 'rejected', resolved_at = now()
         where id = p_message and trip_id = p_trip;
        -- A normal return commits the close. An exception would undo it.
        return 'stale_day';
      end if;
    end if;
  end loop;

  -- Claim the proposal. Only a row still "proposed" matches, so two
  -- submits racing each other cannot both apply.
  update chat_messages
     set diff_status = 'accepted', resolved_at = now()
   where id = p_message and trip_id = p_trip and diff_status = 'proposed';
  if not found then
    raise exception 'proposal already answered';
  end if;

  if p_route is not null then
    if v_trip.start_date is distinct from p_expect_start or v_trip.end_date is distinct from p_expect_end then
      raise exception 'the trip dates changed while this was open - ask again';
    end if;

    perform replace_trip_route(p_trip, p_route);

    -- A day belongs to the route city whose dates contain it (the last
    -- city also owns the departure day). Anything else describes a trip
    -- that no longer exists - a city dropped, or two cities swapped - and
    -- would out-vote the new route if left.
    delete from itinerary_days d
     where d.trip_id = p_trip
       and d.city_id is not null
       and not exists (
         select 1
           from trip_cities c
          where c.trip_id = p_trip
            and c.city_id = d.city_id
            and (
              c.arrive_date is null
              or (d.date >= c.arrive_date and (
                    d.date < c.depart_date
                    or (d.date = c.depart_date and c.depart_date = (select max(depart_date) from trip_cities where trip_id = p_trip))
                  ))
            )
       );
  end if;

  for v_day in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    perform replace_day_items(p_trip, (v_day->>'date')::date, nullif(v_day->>'city_id', ''), v_day->'items');
  end loop;

  -- Older proposals described a trip that no longer exists; close them.
  update chat_messages
     set diff_status = 'rejected', resolved_at = now()
   where trip_id = p_trip and diff_status = 'proposed';

  return 'applied';
end;
$$;

-- ---------------------------------------------- replace_day_items_checked
-- A hand edit that was worked out from the day as read ("Add a place"):
-- under the trip lock, the day must still be what the edit was worked out
-- from, or nothing is written and it returns 'stale_day'. Two adds at
-- once, or an add racing an Accept, can then never silently drop one.
create or replace function replace_day_items_checked(p_trip uuid, p_date date, p_city text, p_items jsonb, p_base jsonb)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;
  if day_base(p_trip, p_date) is distinct from coalesce(p_base, '[]'::jsonb) then
    return 'stale_day';
  end if;
  perform replace_day_items(p_trip, p_date, p_city, p_items);
  return 'applied';
end;
$$;

revoke all on function replace_day_items_checked(uuid, date, text, jsonb, jsonb) from public, anon;
grant execute on function replace_day_items_checked(uuid, date, text, jsonb, jsonb) to authenticated, service_role;

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
