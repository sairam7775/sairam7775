/** Per-user request throttle for expensive routes.
 *
 *  In-memory and therefore per-instance: it stops one user hammering one
 *  server, which is the realistic failure mode while Bento is private. It
 *  is NOT a distributed limiter — before sign-ups open, this needs to move
 *  to Postgres or Redis so the limit holds across instances. */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const refillRate = limit / windowMs;
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  const refilled = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * refillRate);

  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, updatedAt: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.ceil((1 - refilled) / refillRate),
    };
  }

  buckets.set(key, { tokens: refilled - 1, updatedAt: now });
  return { allowed: true, remaining: Math.floor(refilled - 1), retryAfterMs: 0 };
}

/** Bento Man is the expensive route, so it gets the tight limit. */
export const CHAT_LIMIT: RateLimitOptions = { limit: 20, windowMs: 60_000 };
export const UPLOAD_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 };
