import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverKey } from "@/lib/auth-config";

/** An email link's sign-in, held until the person says which account it is
 *  theirs (/auth/confirm). Without that step, a link someone forwarded from
 *  their own inbox would sign the reader in to the sender's account, and
 *  whatever they added next — bookings included — would be the sender's to
 *  read. Nothing is signed in until they confirm: only the session's refresh
 *  token waits, in this cookie, encrypted with a server-only key, for a few
 *  minutes. */
export const PENDING_SIGN_IN_COOKIE = "bento_pending_signin";
export const PENDING_SIGN_IN_PATH = "/auth";
export const PENDING_SIGN_IN_TTL_S = 10 * 60;

export type PendingSignIn = { refreshToken: string; userId: string; email: string; next: string };

const key = () => serverKey("bento pending sign-in v1");

/** `iv.tag.ciphertext` (AES-256-GCM, base64url), or null without a key. */
export function sealPendingSignIn(pending: PendingSignIn, now = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = JSON.stringify({ ...pending, exp: Math.floor(now / 1000) + PENDING_SIGN_IN_TTL_S });
  const data = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function openPendingSignIn(value: string | undefined, now = Date.now()): PendingSignIn | null {
  const k = key();
  const parts = value?.split(".") ?? [];
  if (!k || parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    const body = JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
    const { refreshToken, userId, email, next, exp } = body ?? {};
    if (typeof exp !== "number" || exp * 1000 < now) return null;
    if (![refreshToken, userId, email, next].every((v) => typeof v === "string" && v)) return null;
    return { refreshToken, userId, email, next };
  } catch {
    return null;
  }
}
