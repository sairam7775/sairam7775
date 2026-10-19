import type { SupabaseClient } from "@supabase/supabase-js";

/** Deleting an account, in the order that keeps the rest of the app honest.
 *
 *  1. Model-call costs (`api_usage`) are unlinked, not deleted: the
 *     project-wide spending cap sums them, and deleting an account must
 *     not hand the budget back. They keep the cost and lose the person.
 *  2. Analytics linked to the account are deleted in PostHog, when this
 *     deployment has a PostHog personal API key (see postHogDeleter).
 *  3. The auth user is deleted; every user table cascades from it: trips
 *     (and their days, items, bookings, chat, dismissals), preferences,
 *     rate limits and admin access.
 *
 *  `admin` is the service-role client: only it can delete an auth user. */
// Pauses between tries of the PostHog deletion: three tries in about two
// seconds rides out a blip without holding the person on the page for long.
const RETRY_WAITS_MS = [500, 1500];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function deleteAccountData(
  admin: Pick<SupabaseClient, "from" | "auth">,
  userId: string,
  deleteAnalytics: ((userId: string) => Promise<void>) | null,
  { wait = sleep }: { wait?: (ms: number) => Promise<void> } = {},
): Promise<{ analyticsDeleted: boolean; analyticsPending: boolean }> {
  const unlink = await admin.from("api_usage").update({ user_id: null }).eq("user_id", userId);
  if (unlink.error) throw new Error(`api_usage: ${unlink.error.message}`);

  // Analytics never blocks the deletion: a PostHog outage must not keep
  // someone's account alive. It is tried three times; if it still fails, it
  // is logged for a manual follow-up and the person is told it is pending,
  // never that it is done.
  let analyticsDeleted = false;
  if (deleteAnalytics) {
    for (let attempt = 0; !analyticsDeleted; attempt++) {
      try {
        await deleteAnalytics(userId);
        analyticsDeleted = true;
      } catch (e) {
        if (attempt >= RETRY_WAITS_MS.length) {
          console.error(`PostHog deletion failed for a deleted account (${userId}); delete it by hand.`, e instanceof Error ? e.message : e);
          break;
        }
        await wait(RETRY_WAITS_MS[attempt]);
      }
    }
  }

  const gone = await admin.auth.admin.deleteUser(userId);
  if (gone.error) throw new Error(`auth: ${gone.error.message}`);
  return { analyticsDeleted, analyticsPending: deleteAnalytics !== null && !analyticsDeleted };
}

/** Deletes the PostHog person whose distinct id is this account's id, and
 *  their events. Needs a personal API key with person write access and the
 *  project id; without them there is nothing to call (returns null), and
 *  the privacy page says deletion of analytics happens on request. */
export function postHogDeleter(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  const key = env.POSTHOG_PERSONAL_API_KEY;
  const project = env.POSTHOG_PROJECT_ID;
  if (!key || !project) return null;
  const base = `https://eu.posthog.com/api/projects/${encodeURIComponent(project)}/persons`;
  const headers = { Authorization: `Bearer ${key}` };
  return async (userId: string) => {
    const found = await fetcher(`${base}/?distinct_id=${encodeURIComponent(userId)}`, { headers });
    if (!found.ok) throw new Error(`PostHog lookup ${found.status}`);
    const people = ((await found.json()) as { results?: { id: string }[] }).results ?? [];
    for (const p of people) {
      const del = await fetcher(`${base}/${encodeURIComponent(p.id)}/?delete_events=true`, { method: "DELETE", headers });
      if (!del.ok && del.status !== 404) throw new Error(`PostHog delete ${del.status}`);
    }
  };
}

export const analyticsDeletionConfigured = (env: Record<string, string | undefined> = process.env) =>
  Boolean(env.POSTHOG_PERSONAL_API_KEY && env.POSTHOG_PROJECT_ID);
