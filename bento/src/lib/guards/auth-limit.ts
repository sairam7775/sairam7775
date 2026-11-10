import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverKey } from "@/lib/auth-config";
import { createAdminClient } from "@/lib/supabase/admin";

/** Throttle for password, reset and two-factor attempts.
 *
 *  Supabase Auth limits these per IP, but Bento calls it from Vercel's
 *  servers, so it sees Vercel's address, not the visitor's. These buckets
 *  count per visitor address, per email and per account instead: a token
 *  bucket per (kind, subject) in Postgres (`take_auth_token`, 0029), so the
 *  limit holds across serverless instances. The limits live in the SQL
 *  function, as with `take_rate_token`.
 *
 *  Only the service role can call it: these checks run before anyone is
 *  signed in, and a caller who could spend tokens for any subject could
 *  lock someone else out. Subjects reach the database as keyed hashes, so
 *  it never holds an email or an IP address. */

export type AuthLimitKind =
  | "signin_ip"
  | "signin_email"
  | "signup_ip"
  | "reset_ip"
  | "reset_email"
  | "password_user"
  | "mfa_user";

const LABEL = "bento auth rate-limit v1";

/** The visitor's address as Vercel saw it. IPv6 counts by its /64, since one
 *  connection is usually handed a whole /64 to pick addresses from. */
export function clientIp(h: Headers): string {
  const raw = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().toLowerCase();
  if (!raw) return "unknown";
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!raw.includes(":")) return raw;
  const halves = raw.replace(/^\[|\]$|%.*$/g, "").split("::");
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail] : head;
  if (groups.length !== 8) return raw;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** What the database stores for an email, address or account id. */
export function limiterSubject(value: string, key: Buffer): string {
  return createHmac("sha256", key).update(value.trim().toLowerCase()).digest("hex");
}

/** Takes one token from each bucket in order, and stops at the first that
 *  is empty, so a refused attempt spends nothing from the later ones.
 *  Throws on a database error, a missing function included (migration 0029
 *  goes in before this code): a limiter that waves requests through when it
 *  can't answer is not a limiter. */
export async function takeAuthTokens(db: SupabaseClient, checks: [AuthLimitKind, string][], key: Buffer): Promise<boolean> {
  for (const [kind, value] of checks) {
    const { data, error } = await db.rpc("take_auth_token", { p_kind: kind, p_subject: limiterSubject(value, key) });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean } | undefined;
    if (!row) throw new Error("take_auth_token returned no row");
    if (!row.allowed) return false;
  }
  return true;
}

/** For server actions: "ok", "limited" (too many tries), or "error" (the
 *  limiter couldn't answer, so the attempt is refused). */
export async function authGate(checks: [AuthLimitKind, string][]): Promise<"ok" | "limited" | "error"> {
  const key = serverKey(LABEL);
  if (!key) {
    // Local development without a service-role key; production always has one.
    if (process.env.NODE_ENV !== "production") return "ok";
    console.error("Sign-in limiter has no key: set SUPABASE_SERVICE_ROLE_KEY.");
    return "error";
  }
  try {
    return (await takeAuthTokens(createAdminClient(), checks, key)) ? "ok" : "limited";
  } catch (e) {
    console.error("Sign-in limiter failed:", e instanceof Error ? e.message : (e as { code?: string })?.code ?? e);
    return "error";
  }
}
