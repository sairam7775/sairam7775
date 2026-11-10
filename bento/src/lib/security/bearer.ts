import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Checks an `Authorization: Bearer …` header against a shared secret in
 *  constant time. Both sides are hashed first, so the comparison takes the
 *  same time whatever the length or the first wrong character, and nothing
 *  about the secret leaks through response timing. */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
