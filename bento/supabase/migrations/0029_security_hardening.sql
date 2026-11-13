-- Bento · 0029 · security review of 30 Oct 2026
--
-- Five fixes from the review (Claude, with a second read by Codex):
--   1. No uploads to booking-files: nothing in the app uploads, so the
--      policies only let a signed-in account fill the storage allowance.
--   2. take_auth_token: a throttle for sign-in, sign-up, password reset,
--      current-password checks and two-factor codes. Supabase Auth counts
--      these per IP, but Bento calls it from Vercel, so it sees Vercel's.
--   3. api_usage rows outlive their account. With ON DELETE CASCADE, a hold
--      taken between deleteAccount's unlink and the user's deletion was
--      deleted with them, and its spend left the project-wide cap.
--   4. Bounds on what a traveller can store directly. Every user table is
--      writable over PostgREST within RLS, so the app's limits alone don't
--      hold: a route with two billion nights made every render of its
--      (shared) trip page loop two billion times.
--   5. A daily write allowance per account, so one account can't fill the
--      database through those same direct writes.
--
-- Run it before deploying the code that calls take_auth_token: without the
-- function, sign-in refuses every attempt. The new checks hold for the
-- data there was on 30 Oct (at most 3 nights a city, 5 days a trip).

-- ---------------------------------------------------------------- 1

drop policy if exists "upload own booking files" on storage.objects;
drop policy if exists "update own booking files" on storage.objects;
-- "read own booking files" and "delete own booking files" stay, so anything
-- uploaded before can still be read and removed by its owner.

-- ---------------------------------------------------------------- 2

-- key is "<kind>:<subject>", where the subject is an HMAC the server makes
-- of an email, an IP address or an account id (lib/guards/auth-limit.ts),
-- so this table never holds an address in the clear.
create table auth_rate_limits (
  key        text primary key,
  tokens     double precision not null,
  updated_at timestamptz not null default now()
);

create index auth_rate_limits_updated_idx on auth_rate_limits (updated_at);

-- No policy and no grant: only take_auth_token touches this table.
alter table auth_rate_limits enable row level security;
revoke all on auth_rate_limits from anon, authenticated;

create or replace function take_auth_token(p_kind text, p_subject text)
returns table (allowed boolean, retry_after_ms int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key    text;
  v_limit  int;
  v_window double precision;  -- milliseconds
  v_rate   double precision;  -- tokens per millisecond
  v_now    timestamptz := clock_timestamp();
  v_tokens double precision;
begin
  -- The limits live here, as in take_rate_token (0012).
  case p_kind
    when 'signin_ip'     then v_limit := 30; v_window := 15 * 60000;
    when 'signin_email'  then v_limit := 10; v_window := 15 * 60000;
    when 'signup_ip'     then v_limit := 10; v_window := 60 * 60000;
    when 'reset_ip'      then v_limit := 10; v_window := 60 * 60000;
    -- Keyed by email and address together: counted by email alone, anyone
    -- could use up a person's resets and leave them no way back in.
    when 'reset_email'   then v_limit := 3;  v_window := 60 * 60000;
    when 'password_user' then v_limit := 10; v_window := 15 * 60000;
    when 'mfa_user'      then v_limit := 5;  v_window := 5 * 60000;
    else raise exception 'unknown auth limit kind: %', p_kind;
  end case;
  if p_subject is null or p_subject !~ '^[0-9a-f]{64}$' then
    raise exception 'subject must be a hex HMAC';
  end if;
  v_key := p_kind || ':' || p_subject;
  v_rate := v_limit / v_window;

  -- A bucket untouched for a day is full again, so it can go. Done now and
  -- then rather than on every call, so callers rarely queue behind it.
  if random() < 0.02 then
    delete from auth_rate_limits where updated_at < v_now - interval '1 day';
  end if;

  insert into auth_rate_limits (key, tokens, updated_at)
  values (v_key, v_limit, v_now)
  on conflict (key) do nothing;

  select least(v_limit, r.tokens + extract(epoch from (v_now - r.updated_at)) * 1000 * v_rate)
    into v_tokens
    from auth_rate_limits r
   where r.key = v_key
     for update;

  if v_tokens < 1 then
    update auth_rate_limits set tokens = v_tokens, updated_at = v_now where key = v_key;
    return query select false, ceil((1 - v_tokens) / v_rate)::int;
  else
    update auth_rate_limits set tokens = v_tokens - 1, updated_at = v_now where key = v_key;
    return query select true, 0;
  end if;
end;
$$;

-- The server calls this before anyone is signed in, with the service role.
-- Nobody else may: a caller who could spend tokens for any subject could
-- keep someone else from signing in.
revoke all on function take_auth_token(text, text) from public, anon, authenticated;
grant execute on function take_auth_token(text, text) to service_role;

-- ---------------------------------------------------------------- 3

alter table api_usage
  drop constraint api_usage_user_id_fkey,
  add constraint api_usage_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------- 4

-- The app asks for at most 30 nights a city (tools.ts); 90 is Japan's
-- usual visa-free stay. A year is more than any Bento trip needs, and the
-- vault's gap check walks every night of the trip.
alter table trip_cities add constraint trip_cities_nights_max check (nights <= 90);
alter table trips add constraint trip_length_max check (end_date - start_date <= 366);

-- How many rows one parent may have. Far above what the app makes (a route
-- has at most 8 cities, a day a dozen stops), low enough that no page or
-- shared link has to read an unbounded list. Rows another transaction is
-- inserting at the same moment aren't counted, so parallel requests can
-- each fill up to the cap once; the database's connection pool bounds how
-- many run at once. Locking the parent would make it exact, at the price
-- of deadlocks against the trip-editing functions, which lock in another
-- order. An upsert counts as an insert here, so it too is refused at the
-- cap, which only a parent no real trip reaches can be at.
--   tg_argv[0]  the parent column (a uuid)
--   tg_argv[1]  the most rows one parent may have
create or replace function enforce_row_cap()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_column text := tg_argv[0];
  v_cap    int  := tg_argv[1]::int;
  v_parent uuid := (to_jsonb(new) ->> v_column)::uuid;
  v_count  int;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) ->> v_column)::uuid is not distinct from v_parent then
    return new;
  end if;
  execute format('select count(*) from %I where %I = $1', tg_table_name, v_column)
    into v_count using v_parent;
  if v_count >= v_cap then
    raise exception 'at most % % rows per %', v_cap, tg_table_name, v_column
      using errcode = 'program_limit_exceeded';
  end if;
  return new;
end;
$$;

create trigger trips_row_cap before insert or update of user_id on trips
  for each row execute function enforce_row_cap('user_id', '100');
create trigger trip_cities_row_cap before insert or update of trip_id on trip_cities
  for each row execute function enforce_row_cap('trip_id', '20');
create trigger itinerary_days_row_cap before insert or update of trip_id on itinerary_days
  for each row execute function enforce_row_cap('trip_id', '400');
create trigger itinerary_items_row_cap before insert or update of day_id on itinerary_items
  for each row execute function enforce_row_cap('day_id', '60');
create trigger bookings_row_cap before insert or update of trip_id on bookings
  for each row execute function enforce_row_cap('trip_id', '300');
create trigger gap_dismissals_row_cap before insert or update of trip_id on gap_dismissals
  for each row execute function enforce_row_cap('trip_id', '500');

-- ---------------------------------------------------------------- 5

-- Each statement a signed-in account runs against its own tables is charged
-- by the size of the rows it writes: at most 1 MB a statement and 10 MB in
-- any 24 hours. A busy day of planning writes well under 1 MB; the largest
-- single write, a long Bento Man reply or a trip review's saved plan, is a
-- small part of 1 MB. Writes with no signed-in user — the service role,
-- seeds, migrations — are not charged.
--
-- The charges go in a ledger rather than one counter row per account. A
-- counter row would be locked until commit, and two edits by one account
-- at once (a date change and a day edit, say) would take it and their rows
-- in opposite orders and deadlock. Inserting into the ledger locks nothing
-- shared; the price is that statements committing at the same moment don't
-- see each other's charges, so a burst can pass 10 MB by at most 1 MB per
-- statement running at once.
create table write_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null,
  bytes   bigint not null
);

create index write_usage_user_at_idx on write_usage (user_id, at);
create index write_usage_at_idx on write_usage (at);

-- No policy and no grant: only charge_user_writes touches this table.
alter table write_usage enable row level security;
revoke all on write_usage from anon, authenticated;

create or replace function charge_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_max   constant bigint := 1024 * 1024;        -- one statement
  v_daily constant bigint := 10 * 1024 * 1024;   -- any 24 hours
  v_now   timestamptz := clock_timestamp();
  v_bytes bigint;
  v_used  bigint;
begin
  if v_user is null then
    return null;
  end if;
  select coalesce(sum(octet_length(r::text)), 0) into v_bytes from new_rows r;
  if v_bytes = 0 then
    return null;
  end if;
  if v_bytes > v_max then
    raise exception 'write too large' using errcode = 'program_limit_exceeded';
  end if;

  select coalesce(sum(bytes), 0) into v_used
    from write_usage
   where user_id = v_user and at > v_now - interval '24 hours';
  if v_used + v_bytes > v_daily then
    raise exception 'daily storage allowance used up' using errcode = 'program_limit_exceeded';
  end if;
  insert into write_usage (user_id, at, bytes) values (v_user, v_now, v_bytes);

  -- Old charges go now and then. SKIP LOCKED, so this never waits on
  -- another transaction's purge (and so can't join a deadlock).
  if random() < 0.01 then
    delete from write_usage
     where ctid = any (array(
       select ctid from write_usage where at < v_now - interval '24 hours'
        limit 500 for update skip locked));
  end if;
  return null;
end;
$$;

revoke all on function charge_user_writes() from public, anon, authenticated;

-- A trigger with a transition table can have only one event, so inserts
-- and updates each get their own.
do $$
declare
  t text;
begin
  foreach t in array array['user_preferences', 'trips', 'trip_cities', 'itinerary_days', 'itinerary_items', 'bookings', 'chat_messages', 'trip_reviews', 'gap_dismissals'] loop
    execute format('create trigger %I after insert on %I referencing new table as new_rows for each statement execute function charge_user_writes()', t || '_charge_insert', t);
    execute format('create trigger %I after update on %I referencing new table as new_rows for each statement execute function charge_user_writes()', t || '_charge_update', t);
  end loop;
end;
$$;
