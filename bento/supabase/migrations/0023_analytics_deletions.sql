-- Bento · 0023 · retry PostHog deletion after an account is gone
--
-- PostHog can be unavailable when someone deletes their account. Keep only
-- the account id needed for a later deletion; no auth.users foreign key is
-- possible because the auth row is deleted immediately afterward. Only the
-- service role can access this queue.

create table public.analytics_deletions (
  user_id    uuid primary key,
  queued_at  timestamptz not null default now(),
  attempts   int not null default 0,
  last_error text
);

alter table public.analytics_deletions enable row level security;

revoke all on public.analytics_deletions from public, anon, authenticated;
grant all on public.analytics_deletions to service_role;
