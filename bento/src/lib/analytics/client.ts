"use client";

import posthog from "posthog-js";
import { pathOnly } from "./url";

/** The one door to PostHog. Nothing here runs until the traveller has said
 *  yes (`start`), and every call is a no-op before that, so feature code can
 *  call `track` without checking consent itself.
 *
 *  What may be sent: event names, counts, durations, ids, booleans, and
 *  enum-like labels. Never chat text, a booking's title or reference, an
 *  email, a name or a birth date. Autocapture keeps no element text, and
 *  session replays blank out every piece of text and every field. */

// `initialized`: posthog.init has run (it may only run once per page).
// `started`: capturing now, i.e. the answer is yes.
let initialized = false;
let started = false;
let pendingUser: string | null = null;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

type Bag = Record<string, unknown> | undefined;
const scrub = (bag: Bag) => {
  if (!bag) return;
  for (const [k, v] of Object.entries(bag)) if (typeof v === "string") bag[k] = pathOnly(v);
};

/** Removes the named parameters from the address bar without a reload, once
 *  the page has read them. */
export function dropParams(names: string[]) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!names.some((n) => url.searchParams.has(n))) return;
  for (const n of names) url.searchParams.delete(n);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export const analyticsConfigured = () => Boolean(KEY);

export function start() {
  if (!KEY || typeof window === "undefined") return;
  if (started) return;
  if (initialized) {
    posthog.opt_in_capturing();
    started = true;
    if (pendingUser) posthog.identify(pendingUser);
    return;
  }
  posthog.init(KEY, {
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
    },
    disable_surveys: true,
    before_send: (event) => {
      if (!event) return event;
      scrub(event.properties);
      scrub(event.$set as Bag);
      scrub(event.$set_once as Bag);
      return event;
    },
  });
  initialized = true;
  started = true;
  if (pendingUser) posthog.identify(pendingUser);
}

/** The answer is "no" (or changed to it): stop sending, and remove what
 *  PostHog left in this browser, so a "no" leaves nothing of ours behind
 *  but the answer itself. Safe to call when it never started. */
export function stop() {
  if (started) {
    posthog.opt_out_capturing();
    posthog.reset();
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
  if (started && posthog.get_distinct_id() !== userId) posthog.identify(userId);
}

/** Signing out: the next person on this browser is someone new. */
export function forgetUser() {
  pendingUser = null;
  if (started) posthog.reset();
}

type Prop = string | number | boolean | null | string[];

/** A server message as the name of its line in copy.server ("tooSlow"),
 *  never the sentence itself; "other" when it isn't one of ours. */
export function reasonOf(message: string, lines: Record<string, unknown>): string {
  return Object.entries(lines).find(([, v]) => v === message)?.[0] ?? "other";
}

export function track(event: string, props?: Record<string, Prop>) {
  if (started) posthog.capture(event, props);
}

export function trackError(error: unknown, props?: Record<string, Prop>) {
  if (started) posthog.captureException(error, props);
}
