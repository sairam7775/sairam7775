"use client";

import type { PostHog } from "posthog-js";
import { pathOnly } from "./url";

/** The one door to PostHog. Nothing here runs until the traveller has said
 *  yes (`start`), and every call is a no-op before that, so feature code can
 *  call `track` without checking consent itself. The SDK itself is only
 *  downloaded after a yes.
 *
 *  What may be sent: event names, counts, durations, ids, booleans, and
 *  enum-like labels. Never chat text, a booking's title or reference, an
 *  email, a name or a birth date. Autocapture keeps no element text, and
 *  session replays blank out every piece of text, attribute and field. */

// `ph`: the SDK, once downloaded and initialised (init runs once per page).
// `started`: capturing now, i.e. the answer is yes.
// `wanted`: the latest answer, so a "no" that lands while the SDK is still
// downloading wins.
let ph: PostHog | null = null;
let loading: Promise<PostHog> | null = null;
let started = false;
let wanted = false;
let pendingUser: string | null = null;
// A signed-out page asked to unlink before PostHog had started.
let forgetPending = false;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

type Bag = Record<string, unknown> | undefined;
const scrub = (bag: Bag) => {
  if (!bag) return;
  for (const [k, v] of Object.entries(bag)) if (typeof v === "string") bag[k] = pathOnly(v);
};

export const analyticsConfigured = () => Boolean(KEY);

function load(key: string): Promise<PostHog> {
  loading ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      // Through our own domain (next.config rewrites), so blockers that drop
      // third-party trackers don't hide real errors.
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-05-30",
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      capture_exceptions: true,
      // Clicks are recorded by element, never by the words on it: a chat
      // bubble or a booking name must not reach analytics.
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        // Names also sit in attributes (aria-label="Delete Kyoto trip").
        maskAllElementAttributes: true,
      },
      // Opted out unless told otherwise, so reset() (sign-out, withdrawal) or
      // cleared storage can only ever fall back to not capturing.
      opt_out_capturing_by_default: true,
      disable_surveys: true,
      before_send: (event) => {
        if (!event) return event;
        scrub(event.properties);
        scrub(event.$set as Bag);
        scrub(event.$set_once as Bag);
        return event;
      },
    });
    return posthog;
  });
  return loading;
}

export function start() {
  if (!KEY || typeof window === "undefined") return;
  wanted = true;
  if (started) return;
  void load(KEY).then((posthog) => {
    if (!wanted || started) return;
    const first = ph === null;
    ph = posthog;
    posthog.opt_in_capturing();
    if (!first) posthog.startSessionRecording();
    started = true;
    if (forgetPending) {
      forgetPending = false;
      forgetUser();
    }
    if (pendingUser) posthog.identify(pendingUser);
  });
}

// Withdrawing consent in one tab stops every open Bento tab: the answer is
// an httpOnly cookie other tabs can't watch, so this tab tells them.
const channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("bento-analytics") : null;
channel?.addEventListener("message", (e) => {
  if (e.data === "stop") halt();
});

/** The answer is "no" (or changed to it): stop sending, and remove what
 *  PostHog left in this browser, so a "no" leaves nothing of ours behind
 *  but the answer itself. Safe to call when it never started. */
export function stop() {
  const wasOn = started;
  halt();
  if (wasOn) channel?.postMessage("stop");
}

function halt() {
  wanted = false;
  if (started && ph) {
    // reset() first: it clears consent, and the default is opted out anyway.
    ph.reset();
    ph.opt_out_capturing();
    ph.stopSessionRecording();
    started = false;
  }
  if (typeof window === "undefined") return;
  const ours = (k: string) => k.startsWith("ph_") || k.startsWith("__ph_");
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const k of Object.keys(store)) if (ours(k)) store.removeItem(k);
    } catch {
      // Storage can be blocked; nothing to clear then.
    }
  }
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (ours(name)) document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

/** Link events to the signed-in account by its internal id only. */
export function identify(userId: string) {
  pendingUser = userId;
  forgetPending = false;
  if (started && ph && ph.get_distinct_id() !== userId) ph.identify(userId);
}

/** On a signed-out page: if this browser was still linked to an account
 *  (someone signed out, or a session expired), the next person here is
 *  someone new. Done on the page, after sign-out really happened. */
export function forgetUser() {
  pendingUser = null;
  if (!started || !ph) {
    forgetPending = true;
    return;
  }
  if (ph.get_property("$user_state") !== "identified") return;
  // reset() clears consent; the traveller's "yes" still stands, so opt back in.
  ph.reset();
  ph.opt_in_capturing();
}

type Prop = string | number | boolean | null | string[];

/** A server message as the name of its line in copy.server ("tooSlow"),
 *  never the sentence itself; "other" when it isn't one of ours. */
export function reasonOf(message: string, lines: Record<string, unknown>): string {
  return Object.entries(lines).find(([, v]) => v === message)?.[0] ?? "other";
}

export function track(event: string, props?: Record<string, Prop>) {
  if (started) ph?.capture(event, props);
}

export function trackError(error: unknown, props?: Record<string, Prop>) {
  if (started) ph?.captureException(error, props);
}
