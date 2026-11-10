import type { CookieOptionsWithName } from "@supabase/ssr";

/** Flags for the Supabase session cookies, layered over @supabase/ssr's
 *  defaults (path "/", 400 days). Its default leaves them readable by page
 *  scripts, which only a browser-side Supabase client needs; Bento has none,
 *  so they are httpOnly, and https-only in production. */
export function authCookieOptions(env = process.env.NODE_ENV): CookieOptionsWithName {
  return { httpOnly: true, secure: env === "production", sameSite: "lax" };
}
