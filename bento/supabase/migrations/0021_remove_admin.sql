-- Bento · 0021 · removing an admin, one at a time
--
-- Settings → Admin lets an admin remove someone else's admin access. The
-- rules (never your own, never the last admin, only while you are still an
-- admin yourself) must hold even when two admins act at the same moment:
-- checked in separate calls, two admins removing each other could both see
-- two admins and both delete, leaving none. So the check and the delete are
-- one function, under a lock that queues removals behind each other.
--
-- Called by the server with the service role, after requireAdmin(), with
-- the signed-in admin as p_actor. Nobody else may call it.

create or replace function public.remove_admin(p_actor uuid, p_target uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admins int;
begin
  if p_actor = p_target then
    return 'self';
  end if;

  -- Removals wait for each other here. Each check below then reads what
  -- the removal before it committed (a fresh snapshot per statement).
  lock table app_admins in share row exclusive mode;

  if not exists (select 1 from app_admins where user_id = p_actor) then
    return 'not_admin';
  end if;

  select count(*) into admins from app_admins;
  if admins <= 1 then
    return 'last';
  end if;

  delete from app_admins where user_id = p_target;
  if not found then
    return 'missing';
  end if;
  return 'removed';
end;
$$;

revoke all on function public.remove_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_admin(uuid, uuid) to service_role;
