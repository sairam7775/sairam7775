-- Bento · 0030 · a new companions' link in one transaction
--
-- "Make a new link" was a delete and then an insert, two PostgREST calls.
-- If the insert failed, the old link was already gone and the trip was left
-- unshared. Two renews at once could also end with one of them hitting the
-- unique trip_id and the traveller told it failed although a link existed.
--
-- renew_trip_share does both in one transaction and returns the new token.
-- Security invoker: the own-trip-shares policy and 0020/0024's column
-- grants still decide what the caller may do (the token still comes from
-- the column default; nobody gets UPDATE on it). If any step fails, the
-- whole transaction rolls back and the old link keeps working.
--
-- It first locks the caller's own trip row (FOR UPDATE, as apply_proposal
-- does), so every trip-scoped write queues on the same lock in the same
-- order: trip, then share. A trip deletion takes the trip and then cascades
-- to its share, so the two can't deadlock. Two renews of one trip queue
-- there too: under READ COMMITTED the one that waited gets the trip row
-- once the first commits, and each later statement in this (volatile)
-- function takes a fresh snapshot, so its delete sees the row the first
-- renew committed, removes it and inserts its own: one row, no unique
-- violation.
--
-- Under the lock it re-checks "until the trip ends" by shared_trip()'s
-- rule (0024): a date change committed after the action checked can't
-- leave a renewed link that never opens.
--
-- Run this before deploying the code that calls it.

create or replace function renew_trip_share(p_trip uuid, p_expires_at timestamptz, p_until_trip_end boolean)
returns text
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  tr trips;
  v_token text;
begin
  -- Only the owner's own trip; anyone else gets an error and nothing changes.
  select * into tr from trips where id = p_trip and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'trip not found' using errcode = '42501';
  end if;

  if p_until_trip_end and not (tr.end_date is not null and now() < (tr.end_date + 1)::timestamp at time zone 'UTC') then
    raise exception 'trip has ended' using errcode = '22023';
  end if;

  -- Renewing a trip that isn't shared yet makes its first link, as the
  -- delete-then-insert did.
  delete from trip_shares where trip_id = p_trip;
  insert into trip_shares (trip_id, expires_at, until_trip_end)
  values (p_trip, p_expires_at, coalesce(p_until_trip_end, false))
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function renew_trip_share(uuid, timestamptz, boolean) from public, anon;
grant execute on function renew_trip_share(uuid, timestamptz, boolean) to authenticated;
