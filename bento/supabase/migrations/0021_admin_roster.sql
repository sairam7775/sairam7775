-- Bento · 0021 · changing who is an admin, one change at a time
--
-- Settings → Admin lets an admin give an existing account admin access, or
-- remove someone else's. The rules must hold even when admins act at the
-- same moment, so each check and its write are one function, under a lock
-- that queues every roster change behind the one before:
--
-- - Removing: never your own, never the last admin. Checked in separate
--   calls, two admins removing each other could both see two admins and
--   both delete, leaving none.
-- - Both: only while the one acting is still an admin. A request already
--   on its way when its sender's access is removed must not still give or
--   take access.
--
-- Called by the server with the service role, after requireAdmin(), with
-- the signed-in admin as p_actor. Nobody else may call them.

create or replace function public.add_admin(p_actor uuid, p_target uuid, p_note text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Roster changes wait for each other here. Each check below then reads
  -- what the change before it committed (a fresh snapshot per statement).
  lock table app_admins in share row exclusive mode;

  if not exists (select 1 from app_admins where user_id = p_actor) then
    return 'not_admin';
  end if;

  insert into app_admins (user_id, note) values (p_target, p_note)
  on conflict (user_id) do nothing;
  if not found then
    return 'already';
  end if;
  return 'added';
end;
$$;

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

revoke all on function public.add_admin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.add_admin(uuid, uuid, text) to service_role;
grant execute on function public.remove_admin(uuid, uuid) to service_role;
