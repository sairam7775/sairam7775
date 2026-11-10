import { NextResponse } from "next/server";
import type { Session, User } from "@supabase/supabase-js";
import { PASSWORD_RESET_COOKIE, PASSWORD_RESET_PATH, PASSWORD_RESET_TTL_S, signResetMarker } from "@/lib/auth-config";
import { PENDING_SIGN_IN_COOKIE, PENDING_SIGN_IN_PATH, PENDING_SIGN_IN_TTL_S, sealPendingSignIn } from "@/lib/pending-sign-in";
import { copy } from "@/copy";

/** A code exchange that failed because this browser isn't the one that asked
 *  for the link (PKCE keeps its half of the secret in a cookie). */
export function isWrongBrowser(error: { code?: string } | null): boolean {
  return error?.code === "bad_code_verifier" || error?.code === "pkce_code_verifier_not_found";
}

/** The page someone whose email or sign-in link didn't work can ask for a
 *  new one from, saying why. `next` must already be safeNext'd. */
export function linkFailedPath(next: string, wrongBrowser = false): string {
  const reset = next.startsWith(PASSWORD_RESET_PATH);
  const message = wrongBrowser
    ? copy.auth.errors.linkOtherBrowser(reset)
    : reset
      ? copy.auth.errors.resetLinkUsed
      : copy.auth.errors.signInLinkUsed;
  const page = reset ? "/forgot-password" : "/sign-in";
  return `${page}?${new URLSearchParams({ error: message })}`;
}

export function linkFailed(origin: string, next: string, wrongBrowser = false): NextResponse {
  return NextResponse.redirect(`${origin}${linkFailedPath(next, wrongBrowser)}`);
}

/** The cookies a route handler's response or a server action can set. */
type CookieJar = Pick<NextResponse["cookies"], "set" | "delete">;

/** A reset link's landing gets the short-lived marker that lets
 *  /settings/password skip asking for the old password; any other landing
 *  clears one left behind. */
export function markLanding(jar: CookieJar, next: string, userId: string | undefined): void {
  const marker = next.startsWith(PASSWORD_RESET_PATH) && userId ? signResetMarker(userId) : null;
  if (marker) {
    jar.set(PASSWORD_RESET_COOKIE, marker, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PASSWORD_RESET_TTL_S,
    });
  }
  else jar.delete(PASSWORD_RESET_COOKIE);
}

/** Lands a freshly signed-in user on `next` (already safeNext'd — an open
 *  redirect here would be a credible phishing vector off the back of a real
 *  sign-in). */
export function landSignedIn(origin: string, next: string, user: User | null): NextResponse {
  const response = NextResponse.redirect(`${origin}${next}`);
  markLanding(response.cookies, next, user?.id);
  return response;
}

/** An email link's sign-in isn't this browser's until the visitor confirms
 *  the account at /auth/confirm (lib/pending-sign-in.ts): a link that works
 *  in any browser is also a link someone can forward. `next` must already
 *  be safeNext'd. A link that gave no session lands as before. */
export function holdForConfirmation(origin: string, next: string, session: Session | null, user: User | null): NextResponse {
  if (!session || !user) return landSignedIn(origin, next, user);
  const sealed = user.email ? sealPendingSignIn({ refreshToken: session.refresh_token, userId: user.id, email: user.email, next }) : null;
  if (!sealed) return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: copy.auth.serverError })}`);
  const response = NextResponse.redirect(`${origin}/auth/confirm`);
  response.cookies.set(PENDING_SIGN_IN_COOKIE, sealed, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: PENDING_SIGN_IN_PATH, maxAge: PENDING_SIGN_IN_TTL_S,
  });
  return response;
}
