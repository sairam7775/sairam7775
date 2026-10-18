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

  return { user, db: createAdminClient() };
}
