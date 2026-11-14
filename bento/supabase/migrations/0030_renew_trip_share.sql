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
-- the column default; nobody gets UPDATE on it). If any step fails, nothing
-- changes and the old link keeps working.
--
-- Renews of the same trip queue on a transaction-level advisory lock keyed
-- on the trip. Under READ COMMITTED every statement in this (volatile)
-- function takes a fresh snapshot, so a renew that waited for the lock sees
-- the row the first one committed, deletes it and inserts its own: one row,
-- no unique violation. The lock is released at commit or rollback. Run
-- this before deploying the code that calls it.

create or replace function renew_trip_share(p_trip uuid, p_expires_at timestamptz, p_until_trip_end boolean)
returns text
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  -- Only the owner's own trip: anyone else gets an error and no lock.
  if not exists (select 1 from trips where id = p_trip and user_id = (select auth.uid())) then
    raise exception 'trip not found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('renew_trip_share'), hashtext(p_trip::text));

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
