import type { SupabaseClient } from "@supabase/supabase-js";

/** Deleting an account, in the order that keeps the rest of the app honest.
 *
 *  1. Model-call costs (`api_usage`) are unlinked, not deleted: the
 *     project-wide spending cap sums them, and deleting an account must
 *     not hand the budget back. They keep the cost and lose the person.
 *  2. The auth user is deleted; every user table cascades from it: trips
 *     (and their days, items, bookings, chat, dismissals), preferences,
 *     rate limits and admin access.
 *  3. Only then are the account's analytics deleted in PostHog, when this
 *     deployment has a PostHog personal API key (see postHogDeleter). A
 *     service-role queue row for the daily retry
 *     (`/api/cron/analytics-deletions`) is written before the first try and
 *     taken out when it succeeds. Nothing is queued for an account that is
 *     still there, so the retry can never act on a live one.
 *
 *  `admin` is the service-role client: only it can delete an auth user. */
// Pauses between tries of the PostHog deletion: three tries in about two
// seconds rides out a blip without holding the person on the page for long.
const RETRY_WAITS_MS = [500, 1500];
// Each try is cut off after this, so a stalled PostHog can't hold the page.
const TRY_LIMIT_MS = 5_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Deletes one account's analytics; `signal` cuts a stalled call off. */
export type AnalyticsDeleter = (userId: string, signal?: AbortSignal) => Promise<void>;

/** Analytics not deleted yet: queued for the daily retry, or left for a person. */
export type AnalyticsPending = "retrying" | "by-hand";

export async function deleteAccountData(
  admin: Pick<SupabaseClient, "from" | "auth">,
  userId: string,
  deleteAnalytics: AnalyticsDeleter | null,
  { wait = sleep }: { wait?: (ms: number) => Promise<void> } = {},
): Promise<{ analyticsDeleted: boolean; analyticsPending: AnalyticsPending | null }> {
  const unlink = await admin.from("api_usage").update({ user_id: null }).eq("user_id", userId);
  if (unlink.error) throw new Error(`api_usage: ${unlink.error.message}`);

  const gone = await admin.auth.admin.deleteUser(userId);
  if (gone.error) throw new Error(`auth: ${gone.error.message}`);

  if (!deleteAnalytics) return { analyticsDeleted: false, analyticsPending: null };

  // Analytics never blocks the deletion: a PostHog outage must not keep
  // someone's account alive. The retry is written down before the first try
  // (analytics_deletions has no auth.users foreign key, so it outlives the
  // account), so a request cut off from here on still leaves a record for
  // the daily run. It is tried three times; a success takes the row out
  // again. If the row couldn't be written and PostHog keeps failing, the log
  // says to delete it by hand. The person is told which, never that it is
  // done. An upsert, so a row left from an earlier try can't refuse it.
  const queueError = await queueWrite(() =>
    admin.from("analytics_deletions").upsert({ user_id: userId }, { onConflict: "user_id" }),
  );

  for (let attempt = 0; ; attempt++) {
    try {
      await deleteAnalytics(userId, AbortSignal.timeout(TRY_LIMIT_MS));
      break;
    } catch (e) {
      if (attempt < RETRY_WAITS_MS.length) {
        await wait(RETRY_WAITS_MS[attempt]);
        continue;
      }
      console.error("PostHog deletion failed for a deleted account.", e instanceof Error ? e.message : e);
      if (queueError) console.error(`Could not queue the analytics deletion for account ${userId}; delete it by hand.`, queueError);
      return { analyticsDeleted: false, analyticsPending: queueError ? "by-hand" : "retrying" };
    }
  }

  // Done: take the retry back out. If that fails, the daily run finds
  // nothing left in PostHog and clears the row itself.
  if (!queueError) {
    const cleared = await queueWrite(() => admin.from("analytics_deletions").delete().eq("user_id", userId));
    if (cleared) console.error("Could not clear a finished analytics deletion from the queue.", cleared);
  }
  return { analyticsDeleted: true, analyticsPending: null };
}

/** A queue write's error message, or null; a throw counts as an error too. */
async function queueWrite(write: () => PromiseLike<{ error: { message: string } | null }>) {
  try {
    const { error } = await write();
    return error?.message ?? null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Deletes the PostHog person whose distinct id is this account's id, and
 *  their events. Needs a personal API key with person write access and the
 *  project id; without them there is nothing to call (returns null), and
 *  the privacy page says deletion of analytics happens on request. */
export function postHogDeleter(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): AnalyticsDeleter | null {
  const key = env.POSTHOG_PERSONAL_API_KEY;
  const project = env.POSTHOG_PROJECT_ID;
  if (!key || !project) return null;
  const base = `https://eu.posthog.com/api/projects/${encodeURIComponent(project)}/persons`;
  const headers = { Authorization: `Bearer ${key}` };
  return async (userId, signal) => {
    const found = await fetcher(`${base}/?distinct_id=${encodeURIComponent(userId)}`, { headers, signal });
    if (!found.ok) throw new Error(`PostHog lookup ${found.status}`);
    const people = ((await found.json()) as { results?: { id: string }[] }).results ?? [];
    for (const p of people) {
      const del = await fetcher(`${base}/${encodeURIComponent(p.id)}/?delete_events=true`, { method: "DELETE", headers, signal });
      if (!del.ok && del.status !== 404) throw new Error(`PostHog delete ${del.status}`);
    }
  };
}

export const analyticsDeletionConfigured = (env: Record<string, string | undefined> = process.env) =>
  Boolean(env.POSTHOG_PERSONAL_API_KEY && env.POSTHOG_PROJECT_ID);
