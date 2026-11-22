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

export function timedFetch(
  fetcher?: typeof fetch,
  limits: { readMs: number; writeMs: number } = { readMs: READ_TIMEOUT_MS, writeMs: WRITE_TIMEOUT_MS },
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const ms = method === "GET" || method === "HEAD" ? limits.readMs : limits.writeMs;
    const limit = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, limit]) : limit;
    try {
      // Resolved per call, so the platform's own fetch (Next patches it) is used.
      return await (fetcher ?? globalThis.fetch)(input, { ...init, signal });
    } catch (e) {
      // Named as an abort: postgrest-js retries a failed read three more
      // times (after 1, 2 and 4 s) but never an aborted one, and a request
      // that stalled once would otherwise cost four limits and the waits.
      if (limit.aborted && !init?.signal?.aborted) throw new DOMException(`Supabase request timed out after ${ms} ms`, "AbortError");
      throw e;
    }
  };
}

/** The fetch every server-side Supabase client is built with. */
export const supabaseFetch = timedFetch();
