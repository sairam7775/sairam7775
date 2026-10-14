-- Bento · 0015 · accepting a proposal and moving the dates are each one
-- transaction
--
-- Both used to be several round trips: accepting wrote the route, cleared
-- stale days, wrote each day, and only then closed the proposal; moving
-- the dates wrote the trip, shifted each day, closed stale proposals and
-- re-laid the route. A failure part-way left the trip half changed, and a
-- retry could not repair it (the second attempt saw "no change").
--
-- Each is now one SECURITY INVOKER function, so RLS still applies to the
-- caller and a failure anywhere rolls the lot back. Both take the trip row
-- FOR UPDATE first, which makes competing accepts and date changes on the
-- same trip queue instead of interleaving.

-- ----------------------------------------------------- apply_proposal
--
-- p_route  null, or the accepted route as replace_trip_route takes it
--          (arrive/depart dates already laid on the calendar)
-- p_days   [{ date, city_id, items: [...] }] as replace_day_items takes them
-- p_expect_start / p_expect_end
--          the trip dates the caller laid the route on; if the trip has
--          moved since, refuse rather than apply a route to the wrong dates
create or replace function apply_proposal(
  p_trip         uuid,
  p_message      uuid,
  p_route        jsonb,
  p_days         jsonb,
  p_expect_start date,
  p_expect_end   date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_day  jsonb;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;

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
end;
$$;

-- --------------------------------------------------- update_trip_dates
--
-- p_patch   only the keys present are changed: start_date, end_date,
--           party_size, title (a JSON null clears a date or the title)
-- p_shift   nights to move every planned day by (0 for none)
-- p_cities  [{ city_id, arrive_date, depart_date }] for the re-laid route
-- p_reject  pending proposals that no longer fit and must be closed
create or replace function update_trip_dates(
  p_trip   uuid,
  p_patch  jsonb,
  p_shift  int,
  p_cities jsonb,
  p_reject uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform 1 from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;

  update trips set
    start_date = case when p_patch ? 'start_date' then (p_patch->>'start_date')::date else start_date end,
    end_date   = case when p_patch ? 'end_date'   then (p_patch->>'end_date')::date   else end_date   end,
    party_size = case when p_patch ? 'party_size' then (p_patch->>'party_size')::int  else party_size end,
    title      = case when p_patch ? 'title'      then p_patch->>'title'              else title      end
   where id = p_trip;

  -- (trip_id, date) is unique and a single UPDATE checks it row by row, so
  -- moving days onto each other's dates can collide mid-statement. Park
  -- them far away first, then bring them home shifted.
  if p_shift <> 0 then
    update itinerary_days set date = date + 100000 where trip_id = p_trip;
    update itinerary_days set date = date - 100000 + p_shift where trip_id = p_trip;
  end if;

  if p_reject is not null and array_length(p_reject, 1) > 0 then
    update chat_messages
       set diff_status = 'rejected', resolved_at = now()
     where trip_id = p_trip and diff_status = 'proposed' and id = any (p_reject);
  end if;

  if p_cities is not null then
    update trip_cities t
       set arrive_date = nullif(c->>'arrive_date', '')::date,
           depart_date = nullif(c->>'depart_date', '')::date
      from jsonb_array_elements(p_cities) c
     where t.trip_id = p_trip and t.city_id = c->>'city_id';
  end if;
end;
$$;

revoke all on function apply_proposal(uuid, uuid, jsonb, jsonb, date, date) from public, anon;
revoke all on function update_trip_dates(uuid, jsonb, int, jsonb, uuid[]) from public, anon;
grant execute on function apply_proposal(uuid, uuid, jsonb, jsonb, date, date) to authenticated;
grant execute on function update_trip_dates(uuid, jsonb, int, jsonb, uuid[]) to authenticated;
