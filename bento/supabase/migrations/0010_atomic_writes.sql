-- Bento · 0010 · atomic plan writes, and the views off the open web
--
-- Accepting a route proposal replaced trip_cities as a delete then an
-- insert — two statements, so a failed insert (a repeated city, say) left
-- the route empty. The same shape applied to a day's items. Both are one
-- transaction now, inside SECURITY INVOKER functions so RLS still applies
-- to the caller.

create or replace function replace_trip_route(p_trip uuid, p_cities jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from trips where id = p_trip) then
    raise exception 'trip not found';
  end if;
  delete from trip_cities where trip_id = p_trip;
  insert into trip_cities (trip_id, city_id, nights, sort_order, budget_band, reason, arrive_date, depart_date)
  select
    p_trip,
    c->>'city_id',
    (c->>'nights')::int,
    (c->>'sort_order')::int,
    nullif(c->>'budget_band', '')::budget_band,
    nullif(c->>'reason', ''),
    nullif(c->>'arrive_date', '')::date,
    nullif(c->>'depart_date', '')::date
  from jsonb_array_elements(p_cities) c;
end;
$$;

create or replace function replace_day_items(p_trip uuid, p_date date, p_city text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day uuid;
begin
  if not exists (select 1 from trips where id = p_trip) then
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

revoke all on function replace_trip_route(uuid, jsonb) from public, anon;
revoke all on function replace_day_items(uuid, date, text, jsonb) from public, anon;
grant execute on function replace_trip_route(uuid, jsonb) to authenticated;
grant execute on function replace_day_items(uuid, date, text, jsonb) to authenticated;

-- Reference views are for signed-in travellers, not the open web.
revoke select on city_coverage from anon;
revoke select on places_public from anon;
