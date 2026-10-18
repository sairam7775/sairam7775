"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setAnalytics } from "@/app/settings/actions";
import { ChoiceButton } from "@/components/form-controls";
import { analyticsConfigured, forgetUser, identify, start, stop, track } from "@/lib/analytics/client";
import type { Consent } from "@/lib/analytics/consent";
import { isSharedPath } from "@/lib/analytics/url";
import { copy } from "@/copy";

const choice = "min-h-10 min-w-28 rounded-full border border-ink/25 bg-surface px-5 text-[0.9rem] font-medium text-ink hover:bg-sunk";

/** Starts or stops PostHog to match the stored answer, and asks once when
 *  there is none. Renders nothing when this deployment has no PostHog key
 *  (local work, previews), so nobody is asked about analytics that would
 *  never run.
 *
 *  A shared plan (/shared/…) is opened with its key in the address, often
 *  by someone who has never used Bento: nothing starts there and nobody is
 *  asked. It isn't stopped either, which would forget this browser's own
 *  answer and identity. Leaving the page for the rest of Bento starts it. */
export function Analytics({ consent }: { consent: Consent | null }) {
  const path = usePathname();
  const shared = isSharedPath(path);

  useEffect(() => {
    if (shared) return;
    if (consent === "yes") start();
    else stop();
  }, [consent, shared]);

  // Not over the pages that explain it (the cookies page asks itself).
  if (!analyticsConfigured() || consent !== null || path === "/privacy" || path === "/cookies" || shared) return null;
  const t = copy.consent;

  return (
    <div
      role="region"
      aria-label={t.label}
      className="pop fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-tile bg-surface p-4 shadow-tile print:hidden sm:inset-x-6 sm:p-5"
    >
      <p className="text-[0.9rem] leading-relaxed text-ink-2">
        {t.body}{" "}
        <Link href="/cookies" className="text-accent-ink underline underline-offset-2">{t.more}</Link>
      </p>
      {/* The two answers look alike: saying no must be as easy as saying yes. */}
      <form action={setAnalytics} className="mt-3 flex flex-wrap gap-2">
        {([["yes", t.accept], ["no", t.decline]] as const).map(([value, label]) => (
          <ChoiceButton key={value} name="analytics" value={value} pressed={false} className={choice}>
            {label}
          </ChoiceButton>
        ))}
      </form>
    </div>
  );
}

/** Records one event when it renders: for outcomes only the server knows,
 *  such as a booking that really saved (the page after the redirect).
 *  `consume` names the address parameters that marked the outcome; they are
 *  removed once counted, so going back to that page doesn't count it again. */
export function TrackOnce({ event, props, consume }: { event: string; props?: Record<string, string | number | boolean | null>; consume: string[] }) {
  const key = JSON.stringify(props ?? {});
  const marks = consume.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    const names = marks.split(",");
    if (!names.some((n) => url.searchParams.has(n))) return;
    track(event, JSON.parse(key));
    for (const n of names) url.searchParams.delete(n);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [event, key, marks]);
  return null;
}

/** Put on signed-in pages: links events to the account's internal id
 *  (never the email). Does nothing until analytics has started. */
export function AnalyticsUser({ id }: { id: string }) {
  useEffect(() => {
    identify(id);
  }, [id]);
  return null;
}

/** Put on pages a signed-out visitor sees (home, sign-in): unlinks the
 *  account if this browser just signed out. */
export function AnalyticsSignedOut() {
  useEffect(() => {
    forgetUser();
  }, []);
  return null;
}
