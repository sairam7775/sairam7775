/** A time limit on every request a server-side Supabase client makes, so one
 *  slow or stalled dependency can't hang a page, an action or a chat turn
 *  until the platform kills it. A request cut off fails the way a network
 *  error does: PostgREST calls return `{ error }` ("AbortError: Supabase
 *  request timed out …") and every caller's existing error path takes it;
 *  auth calls return an error and no user (supabase-auth may retry a token
 *  refresh once more within its own 30 s window).
 *
 *  Reads get 10 s. Writes, which include every RPC (a POST: apply_proposal,
 *  reserve_spend under its lock), get 15 s. Supabase's default statement
 *  timeout for the signed-in role is 8 s, so a statement the database lets
 *  run is normally finished, committed or rolled back, before the client
 *  gives up; a client timeout then means the network or the API stalled.
 *  (The service role has no statement timeout of its own by default; its
 *  calls here are short: the spend holds, the auth limiter, admin reads.)
 *  The chat turn's deadline (bento-man/chat.ts) leaves room for a write or
 *  two of 15 s after it, inside the route's maxDuration. */
export const READ_TIMEOUT_MS = 10_000;
export const WRITE_TIMEOUT_MS = 15_000;

const TIMED_OUT = "Supabase request timed out";

export function timedFetch(
  fetcher?: typeof fetch,
  limits: { readMs: number; writeMs: number } = { readMs: READ_TIMEOUT_MS, writeMs: WRITE_TIMEOUT_MS },
): typeof fetch {
  return (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const ms = method === "GET" || method === "HEAD" ? limits.readMs : limits.writeMs;
    // The limit aborts with an AbortError of its own, whether the request is
    // waiting for its headers or reading its body: postgrest-js retries a
    // failed read three more times (after 1, 2 and 4 s) but never an aborted
    // one, which would otherwise make one stall cost four limits and the
    // waits; and callers can tell a timeout (`isSupabaseTimeout`) from a
    // refusal. The timer is unref'd and a late abort does nothing.
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(new DOMException(`${TIMED_OUT} after ${ms} ms`, "AbortError")), ms);
    (timer as { unref?: () => void }).unref?.();
    const signal = init?.signal ? AbortSignal.any([init.signal, limit.signal]) : limit.signal;
    // Resolved per call, so the platform's own fetch (Next patches it) is used.
    return (fetcher ?? globalThis.fetch)(input, { ...init, signal });
  };
}

/** A request this module cut off, as thrown or as PostgREST's `{ error }`
 *  ("AbortError: Supabase request timed out after … ms"). For a write, the
 *  database may have committed it: say the outcome is unknown, never that
 *  it failed. Its text is never for a traveller. */
export function isSupabaseTimeout(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.includes(TIMED_OUT);
}

/** The fetch every server-side Supabase client is built with. */
export const supabaseFetch = timedFetch();
