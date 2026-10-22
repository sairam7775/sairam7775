import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Whether this signed-in user is an admin. RLS lets an admin read their own
 *  row of `app_admins` and nobody else's, so this works on the user's own
 *  client and says nothing about anyone else. */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Where an admin proves a second factor (Settings → Admin → two-factor). */
export const TWO_FACTOR_PATH = "/settings/admin/two-factor";

/** Whether this session was signed in with a second factor (Supabase's
 *  "aal2"). Admins can read travellers' trip reviews, so admin pages and
 *  actions need it; anything unreadable counts as no. */
export async function hasTwoFactorSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

/** Gate for every curation route and admin action.
 *
 *  Curation writes never happen from the browser and never through the
 *  user's own client — `places` is deliberately ungranted to
 *  `authenticated` so that the verification gate cannot be walked around.
 *  Admins are checked here, then written for by the service role. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/admin");

  // 404 rather than 403: a signed-in stranger learns nothing about
  // whether these routes exist.
  if (!(await isAdmin(supabase, user.id))) notFound();
  // An admin, but not signed in with a second factor yet: set one up or
  // enter its code first. Checked here, so every admin action has it too.
  if (!(await hasTwoFactorSession(supabase))) redirect(TWO_FACTOR_PATH);

  return { user, db: createAdminClient() };
}
