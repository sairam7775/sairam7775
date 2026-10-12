-- places_public and city_coverage are read paths. Supabase's default
-- privileges grant anon and authenticated INSERT/UPDATE/DELETE on every new
-- relation, and places_public is a simple single-table view, so Postgres
-- treats it as auto-updatable. It runs as its owner (security_invoker =
-- false), which bypasses the RLS on places: anyone holding the anon key
-- could rewrite or delete verified guide data through it.
--
-- Read access stays exactly as before (SELECT for authenticated).

revoke insert, update, delete, truncate, references, trigger
  on public.places_public, public.city_coverage
  from anon, authenticated;
