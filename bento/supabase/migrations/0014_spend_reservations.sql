-- Bento · 0014 · spend reservations and a project-wide cap
--
-- The spend cap read the month's total, then let the call run, then
-- recorded what it cost. Ten parallel messages all read the same total,
-- all passed, and all spent. And the cap was per user, so many users could
-- together exceed what the owner is willing to pay.
--
-- Now a call first RESERVES an estimate, in one transaction, under a lock
-- that serialises every reservation. The reservation is an api_usage row
-- (model = 'reserved'), so the next caller's total already includes it.
-- When the call ends, settle_spend swaps the estimate for the real cost.
-- The estimate is the most ONE model call can cost, and a hold is granted
-- only if it fits both caps; a chat turn takes a fresh hold per model call.
--
-- A reservation whose process died never settles; after ten minutes it
-- stops counting, so a crash cannot hold the cap down forever.
--
-- Every function here takes a cap or a user id, so none of them may be
-- reachable over /rest/v1/rpc/: server (service role) only.

create or replace function public.spend_since_month_start(p_user uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0)
  from api_usage
  where created_at >= date_trunc('month', now())
    and (p_user is null or user_id = p_user)
    and (model is distinct from 'reserved' or created_at > now() - interval '10 minutes');
$$;

create or replace function public.reserve_spend(
  p_user       uuid,
  p_kind       text,
  p_estimate   numeric,
  p_user_cap   numeric,
  p_global_cap numeric
)
returns table (reservation_id bigint, refused text, user_spent numeric, global_spent numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   numeric;
  v_global numeric;
  v_id     bigint;
begin
  -- One lock for every reservation: the project-wide total is the thing
  -- being protected, so they must queue. A held-for-milliseconds lock is
  -- cheap at this scale.
  perform pg_advisory_xact_lock(hashtext('bento_spend'));

  v_user   := spend_since_month_start(p_user);
  v_global := spend_since_month_start(null);

  -- The hold must FIT: a total just under the cap plus a call that can
  -- cost more than what's left would otherwise be granted and overshoot.
  if v_user + p_estimate > p_user_cap then
    return query select null::bigint, 'user'::text, v_user, v_global;
    return;
  end if;
  if v_global + p_estimate > p_global_cap then
    return query select null::bigint, 'global'::text, v_user, v_global;
    return;
  end if;

  insert into api_usage (user_id, kind, model, cost_usd)
  values (p_user, p_kind, 'reserved', p_estimate)
  returning id into v_id;

  return query select v_id, null::text, v_user, v_global;
end;
$$;

-- Swap a reservation's estimate for what the call really cost. A call that
-- never reached the model (all zero) leaves nothing behind.
create or replace function public.settle_spend(
  p_id            bigint,
  p_model         text,
  p_input_tokens  int,
  p_output_tokens int,
  p_cached_tokens int,
  p_cost          numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_input_tokens = 0 and p_output_tokens = 0 then
    delete from api_usage where id = p_id and model = 'reserved';
    return;
  end if;

  update api_usage
     set model = p_model,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         cached_tokens = p_cached_tokens,
         cost_usd = p_cost
   where id = p_id and model = 'reserved';
end;
$$;

revoke execute on function public.spend_since_month_start(uuid) from anon, authenticated, public;
revoke execute on function public.reserve_spend(uuid, text, numeric, numeric, numeric) from anon, authenticated, public;
revoke execute on function public.settle_spend(bigint, text, int, int, int, numeric) from anon, authenticated, public;
