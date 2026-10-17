import type { User } from "@supabase/supabase-js";

/** Signed up with Google and never set a Bento password: there is no
 *  password to change, or to confirm a deletion with. */
export function googleOnly(user: Pick<User, "app_metadata" | "identities">): boolean {
  return user.app_metadata?.provider === "google" && !(user.identities ?? []).some((i) => i.provider === "email");
}
