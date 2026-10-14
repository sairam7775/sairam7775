import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Gate for every curation route.
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

  const { data } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // 404 rather than 403: a signed-in stranger learns nothing about
  // whether these routes exist.
  if (!data) notFound();

  return { user, db: createAdminClient() };
}
