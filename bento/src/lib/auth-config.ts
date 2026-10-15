import { createHmac, timingSafeEqual } from "node:crypto";

/** Set by /auth/callback when a password-reset link is used: proof, for a
 *  few minutes, that this browser came through the emailed link — so the
 *  new password can be set without the forgotten one. The value is
 *  `userId.expiry.signature`, signed with a server-only key, so it can't be
 *  forged from a user id; it only counts for that user, and sign-in and
 *  sign-out clear it. */
export const PASSWORD_RESET_COOKIE = "bento_pw_reset";
export const PASSWORD_RESET_PATH = "/settings/password";
export const PASSWORD_RESET_TTL_S = 15 * 60;

// BENTO_AUTH_SECRET if set, else derived from the service-role key — which
// every deployment already needs for the server — under its own label, so
// the two uses can't stand in for each other.
function resetKey(): Buffer | null {
  const raw = process.env.BENTO_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) return null;
  return createHmac("sha256", raw).update("bento password-reset marker v1").digest();
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signResetMarker(userId: string, now = Date.now()): string | null {
  const key = resetKey();
  if (!key) return null;
  const payload = `${userId}.${Math.floor(now / 1000) + PASSWORD_RESET_TTL_S}`;
  return `${payload}.${sign(payload, key)}`;
}

export function inPasswordReset(cookieValue: string | undefined, userId: string | undefined, now = Date.now()): boolean {
  const key = resetKey();
  if (!key || !cookieValue || !userId) return false;
  const [id, exp, mac, ...rest] = cookieValue.split(".");
  if (rest.length || !id || !exp || !mac || id !== userId) return false;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  const want = Buffer.from(sign(`${id}.${exp}`, key));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Google sign-in needs a Google OAuth client and the provider switched on
 *  in Supabase. Until both are done the button would lead to a raw error
 *  page, so it stays hidden unless BENTO_GOOGLE_SIGN_IN=1. */
export function googleSignInEnabled(): boolean {
  return process.env.BENTO_GOOGLE_SIGN_IN === "1";
}
