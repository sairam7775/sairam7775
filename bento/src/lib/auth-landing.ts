import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { PASSWORD_RESET_COOKIE, PASSWORD_RESET_PATH, PASSWORD_RESET_TTL_S, signResetMarker } from "@/lib/auth-config";
import { copy } from "@/copy";

/** A code exchange that failed because this browser isn't the one that asked
 *  for the link (PKCE keeps its half of the secret in a cookie). */
export function isWrongBrowser(error: { code?: string } | null): boolean {
  return error?.code === "bad_code_verifier" || error?.code === "pkce_code_verifier_not_found";
}

/** Sends someone whose email or sign-in link didn't work back to the page
 *  they can ask for a new one from. `next` must already be safeNext'd. */
export function linkFailed(origin: string, next: string, wrongBrowser = false): NextResponse {
  const reset = next.startsWith(PASSWORD_RESET_PATH);
  const message = wrongBrowser
    ? copy.auth.errors.linkOtherBrowser(reset)
    : reset
      ? copy.auth.errors.resetLinkUsed
      : copy.auth.errors.signInLinkUsed;
  const page = reset ? "/forgot-password" : "/sign-in";
  return NextResponse.redirect(`${origin}${page}?${new URLSearchParams({ error: message })}`);
}

/** Lands a freshly signed-in user on `next` (already safeNext'd — an open
 *  redirect here would be a credible phishing vector off the back of a real
 *  sign-in). A reset link also gets the short-lived marker that lets
 *  /settings/password skip asking for the old password. */
export function landSignedIn(origin: string, next: string, user: User | null): NextResponse {
  const response = NextResponse.redirect(`${origin}${next}`);
  const marker = next.startsWith(PASSWORD_RESET_PATH) && user ? signResetMarker(user.id) : null;
  if (marker) {
    response.cookies.set(PASSWORD_RESET_COOKIE, marker, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PASSWORD_RESET_TTL_S,
    });
  }
  else response.cookies.delete(PASSWORD_RESET_COOKIE);
  return response;
}
