-- Bento · 0016 · a date change is a proposal the traveller accepts (#6)
--
-- Bento Man used to move a trip's dates the moment the model asked. Now
-- moving dates the trip already has is proposed, and accepting it applies
-- the date change and anything proposed with it (a route laid on the new
-- dates, days planned on them) in one transaction. A traveller can say
-- Bento Man may change dates without asking; only their own action sets
-- that, never a tool.

alter table user_preferences
  add column apply_dates_without_asking boolean not null default false;

-- ------------------------------------------- apply_proposal_with_dates
--
-- p_expect_start / p_expect_end
--          the trip dates the proposal was made against; if the trip has
--          moved since, refuse rather than move it from the wrong place
-- p_patch, p_shift, p_cities, p_reject
--          the date change, exactly as update_trip_dates takes it
-- p_route, p_days
--          the rest of the proposal, as apply_proposal takes it, laid on
--          the NEW dates
--
-- Composes the two 0015 functions, so the rules stay in one place. It runs
-- as the caller (RLS applies) and any failure rolls back all of it,
-- including the claim on the proposal.
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
  v_trip trips%rowtype;
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
  perform apply_proposal(p_trip, p_message, p_route, p_days, v_trip.start_date, v_trip.end_date);
end;
$$;

revoke all on function apply_proposal_with_dates(uuid, uuid, date, date, jsonb, int, jsonb, uuid[], jsonb, jsonb) from public, anon;
grant execute on function apply_proposal_with_dates(uuid, uuid, date, date, jsonb, int, jsonb, uuid[], jsonb, jsonb) to authenticated;
