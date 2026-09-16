/** Booking references, encrypted at rest.
 *
 *  A PNR plus a surname is often enough to view or cancel someone's
 *  flight (§15). So a reference is encrypted before it is stored,
 *  decrypted only to show the traveller their own booking, never written
 *  to a log, and never placed in a model prompt.
 *
 *  AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt
 *  rather than returning plausible rubbish. The nonce is random per
 *  record and stored with it — reusing a nonce under one key is the way
 *  GCM breaks, so it is never derived from anything. */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";

/** Thrown rather than returning null: a reference that cannot be read is
 *  a bug or a key change, and either way must not pass silently. */
export class BookingRefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingRefError";
  }
}

function key(): Buffer {
  const raw = process.env.BENTO_BOOKING_REF_KEY;
  if (!raw) {
    throw new BookingRefError("BENTO_BOOKING_REF_KEY is not set. Generate one with: openssl rand -base64 32");
  }
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new BookingRefError(`BENTO_BOOKING_REF_KEY must decode to 32 bytes, got ${k.length}. Generate one with: openssl rand -base64 32`);
  }
  return k;
}

/** True when the server can hold references at all. The vault degrades to
 *  storing everything except the reference rather than refusing the
 *  booking, so a missing key never loses a traveller's data. */
export function canEncrypt(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** "v1.<nonce>.<ciphertext+tag>", all base64url. The version prefix means
 *  a future algorithm change can read old rows instead of orphaning them. */
export function encryptRef(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) throw new BookingRefError("nothing to encrypt");
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key(), nonce);
  const body = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${nonce.toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptRef(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) throw new BookingRefError("stored reference is not in a format this build can read");
  const nonce = Buffer.from(parts[1], "base64url");
  const body = Buffer.from(parts[2], "base64url");
  if (nonce.length !== NONCE_BYTES || body.length <= TAG_BYTES) throw new BookingRefError("stored reference is malformed");
  const tag = body.subarray(body.length - TAG_BYTES);
  const cipher = body.subarray(0, body.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key(), nonce);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(cipher), decipher.final()]).toString("utf8");
  } catch {
    throw new BookingRefError("this reference could not be decrypted — the encryption key has changed since it was saved");
  }
}

/** What a list shows: enough to recognise it, not enough to use it.
 *  "ABC123" → "•••123". Short references show as dots only. */
export function maskRef(plain: string): string {
  const s = plain.trim();
  if (s.length <= 3) return "•".repeat(Math.max(3, s.length));
  return `•••${s.slice(-3)}`;
}
