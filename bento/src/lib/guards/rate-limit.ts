import type { SupabaseClient } from "@supabase/supabase-js";

/** Per-user request throttle for expensive routes.
 *
 *  A token bucket per (user, kind) in Postgres (`take_rate_token`, 0012),
 *  so the limit holds across serverless instances. The limits live in the
 *  SQL function, not here: it is callable over RPC, and a caller that
 *  chose its own limit could refill its own bucket.
 *
 *  Takes the signed-in user's client — the function keys on auth.uid(), so
 *  no service role is needed and no user can spend another's tokens. */

export type RateLimitKind = "chat" | "parse";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function rateLimit(db: SupabaseClient, kind: RateLimitKind): Promise<RateLimitResult> {
  const { data, error } = await db.rpc("take_rate_token", { p_kind: kind });
  // Fail closed: a limiter that waves requests through when the database
  // is unhappy is not a limiter.
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; remaining: number; retry_after_ms: number }
    | undefined;
  if (!row) throw new Error("take_rate_token returned no row");
  return { allowed: row.allowed, remaining: row.remaining, retryAfterMs: row.retry_after_ms };
}
