import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses every RLS policy, so it must never be
 *  constructed in code that can reach the browser.
 *
 *  Used for curation writes (P2) and for recording API usage, which users
 *  may read but must not write — a client able to write its own usage rows
 *  could also under-report them. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
