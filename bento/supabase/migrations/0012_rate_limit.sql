-- Bento · 0012 · the rate limiter moves into Postgres
--
-- The in-memory limiter held per server instance, so on serverless it
-- stopped limiting exactly when it mattered. A token bucket per (user,
-- kind) in one row, taken under a row lock, holds across every instance.
--
-- The limits live here, not in the caller. The function is reachable over
-- /rest/v1/rpc/, and a caller that chose its own limit could refill its
-- own bucket at will. It keys on auth.uid(), so the most anyone can do by
-- calling it directly is spend their own tokens.

create table rate_limits (
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  tokens     double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

-- No policy on purpose: only take_rate_token touches this table.
alter table rate_limits enable row level security;

create or replace function take_rate_token(p_kind text)
returns table (allowed boolean, remaining int, retry_after_ms int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_limit  int;
  v_window double precision;  -- milliseconds
  v_rate   double precision;  -- tokens per millisecond
  v_now    timestamptz := clock_timestamp();
  v_tokens double precision;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  -- Bento Man is the expensive route, so it gets the tight limit.
  case p_kind
    when 'chat'  then v_limit := 20; v_window := 60000;
    when 'parse' then v_limit := 10; v_window := 60000;
    else raise exception 'unknown rate limit kind: %', p_kind;
  end case;
  v_rate := v_limit / v_window;

  insert into rate_limits (user_id, kind, tokens, updated_at)
  values (v_user, p_kind, v_limit, v_now)
  on conflict (user_id, kind) do nothing;

  select least(v_limit, r.tokens + extract(epoch from (v_now - r.updated_at)) * 1000 * v_rate)
    into v_tokens
    from rate_limits r
   where r.user_id = v_user and r.kind = p_kind
     for update;

  if v_tokens < 1 then
    update rate_limits set tokens = v_tokens, updated_at = v_now
     where user_id = v_user and kind = p_kind;
    return query select false, 0, ceil((1 - v_tokens) / v_rate)::int;
  else
    update rate_limits set tokens = v_tokens - 1, updated_at = v_now
     where user_id = v_user and kind = p_kind;
    return query select true, floor(v_tokens - 1)::int, 0;
  end if;
end;
$$;

revoke all on function take_rate_token(text) from public, anon;
grant execute on function take_rate_token(text) to authenticated;
