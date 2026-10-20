-- Bento · 0022 · close temporary-schema shadowing in definer functions
--
-- A SECURITY DEFINER function that omits pg_temp can resolve a temporary
-- table before the public table it is meant to use. Put pg_temp last in the
-- search path for every remaining definer function. A stricter empty path
-- (`''`, with every object schema-qualified) is a possible later step.

alter function public.month_to_date_spend(uuid) set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.take_rate_token(text) set search_path = public, pg_temp;
alter function public.reserve_spend(uuid, text, numeric, numeric, numeric) set search_path = public, pg_temp;
alter function public.settle_spend(bigint, text, int, int, int, numeric) set search_path = public, pg_temp;
