-- Bento · 0028 · a date change never moves a trip from the wrong place
--
-- update_trip_dates takes its shift worked out in advance, from the trip
-- dates the request read. Two changes read at once (a double-click on Save,
-- or Bento Man and the edit form together) each passed the same shift, the
-- row lock only queued them, and the planned days moved twice: a day on
-- 20 Nov ended on 22 Nov for a one-night move. The caller now says which
-- dates it read (p_expect), checked under the lock, and a trip that moved
-- since is refused, as apply_proposal_with_dates already does (0016).
-- Codex review on #3.
--
-- p_expect  {"start_date": ..., "end_date": ...} as the caller read them
--           (JSON null for a date the trip did not have). Left out, nothing
--           is checked: apply_proposal_with_dates checks its own
--           expectation under the same lock before calling this.

drop function update_trip_dates(uuid, jsonb, int, jsonb, uuid[]);

create function update_trip_dates(
  p_trip   uuid,
  p_patch  jsonb,
  p_shift  int,
  p_cities jsonb,
  p_reject uuid[],
  p_expect jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_trip trips%rowtype;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then
    raise exception 'trip not found';
  end if;
  if p_expect is not null and (
       v_trip.start_date is distinct from (p_expect->>'start_date')::date
    or v_trip.end_date   is distinct from (p_expect->>'end_date')::date
  ) then
    raise exception 'the trip dates changed meanwhile - check them and try again';
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

revoke all on function update_trip_dates(uuid, jsonb, int, jsonb, uuid[], jsonb) from public, anon;
grant execute on function update_trip_dates(uuid, jsonb, int, jsonb, uuid[], jsonb) to authenticated;
