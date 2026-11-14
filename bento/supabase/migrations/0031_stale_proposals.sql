-- Bento · 0031 · an old proposal never overwrites a day changed since
--
-- Bento Man proposed a day, the traveller then edited that day by hand, and
-- pressing Accept on the old card replaced the day: the hand edit was lost
-- without a word (open question Q13). Run this before deploying the code
-- that needs it.
--
-- Each day of a proposal now carries `base`: the day's stops as they were
-- saved when the proposal was made (place, order, pin, start, duration and
-- the travel to it, the fields a hand edit can change). apply_proposal
-- compares every base with the stops saved now, under the trip lock and
-- before writing anything. If one differs, nothing from the proposal is
-- applied (route, days or dates) and only that proposal is closed as
-- rejected. The function returns 'applied' or 'stale_day'; every other
-- failure still raises, which rolls everything back. Returning instead of
-- raising is what lets the close commit.
--
-- A day without `base` (stored before this) is not checked. Nor are date
-- proposals that also carry days: apply_proposal_with_dates strips `base`,
-- because those days may have been planned on the shifted calendar and the
-- original date of each is not recorded, so neither calendar is a sound
-- comparison.
--
-- replace_day_items (every hand edit) now takes the same trip lock, so a
-- hand edit and an Accept queue rather than interleave.
--
-- The return type changes from void to text, which needs a drop. A drop
-- also drops the grants, and Supabase's default privileges would give a new
-- function to anon, so the grants from 0015 are restated: authenticated and
-- service_role may execute it, anon and public may not.

-- ----------------------------------------------------- apply_proposal

drop function if exists apply_proposal(uuid, uuid, jsonb, jsonb, date, date);

create function apply_proposal(
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
      select coalesce(jsonb_agg(jsonb_build_object(
        'placeId', i.place_id, 'sortOrder', i.sort_order, 'locked', i.locked,
        'startMin', (extract(hour from i.start_time) * 60 + extract(minute from i.start_time))::int,
        'durationMin', i.duration_min, 'arriveMode', i.arrive_mode,
        'arriveMinutes', i.arrive_minutes, 'arriveDetail', i.arrive_detail
      ) order by i.sort_order), '[]'::jsonb) into v_base
      from itinerary_items i join itinerary_days d on d.id = i.day_id
      where d.trip_id = p_trip and d.date = (v_day->>'date')::date;
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

revoke all on function apply_proposal(uuid, uuid, jsonb, jsonb, date, date) from public, anon;
grant execute on function apply_proposal(uuid, uuid, jsonb, jsonb, date, date) to authenticated, service_role;

-- Date proposals keep their previous behaviour: days can have been planned
-- before or after a shift within a turn. Without an original date per day,
-- comparing against either calendar would be a partial, possibly wrong check.
-- Same signature and return type as 0016, so its grants stay.
create or replace function apply_proposal_with_dates(
  p_trip         uuid,
  p_message      uuid,
  p_expect_start date,
  p_expect_end   date,
  p_patch        jsonb,
  p_shift        int,
  p_cities       jsonb,
  p_reject       uuid[],
  p_route        jsonb,
  p_days         jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trip    trips%rowtype;
  v_days    jsonb;
  v_outcome text;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;
  if v_trip.start_date is distinct from p_expect_start or v_trip.end_date is distinct from p_expect_end then
    raise exception 'the trip dates changed while this was open - ask again';
  end if;

  -- The proposal being accepted is claimed by apply_proposal below; it
  -- must not be closed as "no longer fits" on the way.
  perform update_trip_dates(p_trip, coalesce(p_patch, '{}'::jsonb), coalesce(p_shift, 0), p_cities, array_remove(p_reject, p_message));

  select * into v_trip from trips where id = p_trip;
  select coalesce(jsonb_agg(d - 'base'), '[]'::jsonb) into v_days
    from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) d;
  v_outcome := apply_proposal(p_trip, p_message, p_route, v_days, v_trip.start_date, v_trip.end_date);
  -- With every base stripped nothing can be stale; anything but 'applied'
  -- would mean the dates moved without the rest, so undo the lot.
  if v_outcome is distinct from 'applied' then
    raise exception 'proposal not applied: %', coalesce(v_outcome, 'no outcome');
  end if;
end;
$$;

-- Hand edits take the same lock as Accept, including for an empty day.
-- Same signature and return type as 0010, so its grants stay.
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
  insert into itinerary_items (day_id, place_id, sort_order, start_time, duration_min, locked, reason, reason_terms, arrive_mode, arrive_minutes, arrive_detail)
  select
    v_day,
    i->>'place_id',
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
