-- Bento · 0005 · lock down SECURITY DEFINER functions
--
-- Supabase exposes every function in the public schema over
-- /rest/v1/rpc/. Neither of these should be reachable that way.

-- month_to_date_spend takes a user id and runs as definer, so over RPC any
-- signed-in user could read another user's spend by passing their uuid.
-- Only the server (service role) needs it.
revoke execute on function public.month_to_date_spend(uuid) from anon, authenticated, public;

-- A trigger function has no business being callable directly.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ---------------------------------------------------------------
-- Two database-linter findings remain and are deliberate. They are
-- recorded in the database itself so a future reader does not "fix" the
-- verification gate by removing it.
--
--   rls_enabled_no_policy on places  — intended: no policy means no direct
--     read, which is what forces everything through places_public.
--   security_definer_view on places_public — intended: the view must read
--     past that RLS while users hold no grant on the table.
-- ---------------------------------------------------------------

comment on table public.places is
  'Curated guide database. RLS is enabled with NO select policy on purpose: '
  'users hold no grant on this table and read places_public instead, which '
  'strips judgement fields from unverified records. Writes happen through '
  'the service role during curation.';

comment on view public.places_public is
  'The verification gate. SECURITY DEFINER is required, not accidental: the '
  'view must read past the RLS on places while users hold no direct grant. '
  'Judgement fields (durations, crowd notes, skip_if, local tips) read as '
  'NULL until a human has set verification_status = verified. Safe as '
  'definer because places is global reference data with no per-user rows; '
  'if that ever changes, this view must be revisited first.';
