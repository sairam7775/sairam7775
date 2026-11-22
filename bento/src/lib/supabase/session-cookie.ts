/** Supabase keeps a session in cookies named `sb-<project>-auth-token`
 *  (split into `.0`, `.1`… when long). */
const AUTH_COOKIE = /^sb-.+-auth-token/;

/** Whether this request could carry a session. False means signed out for
 *  certain: with none of these cookies, getUser() answers "no user" without
 *  asking Supabase (session-cookie.test.ts checks that against the real
 *  client). True means only "maybe": the cookie is unverified, so it never
 *  grants anything; ask getUser(). Lets a public page draw its signed-out
 *  version at once instead of waiting on the check. */
export function mayHaveSession(cookies: readonly { name: string }[]): boolean {
  return cookies.some(({ name }) => AUTH_COOKIE.test(name));
}
