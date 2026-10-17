"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setAnalytics } from "@/app/settings/actions";
import { ChoiceButton } from "@/components/form-controls";
import { analyticsConfigured, identify, start, stop, track } from "@/lib/analytics/client";
import type { Consent } from "@/lib/analytics/consent";
import { copy } from "@/copy";

/** Starts or stops PostHog to match the stored answer, and asks once when
 *  there is none. Renders nothing when this deployment has no PostHog key
 *  (local work, previews), so nobody is asked about analytics that would
 *  never run. */
export function Analytics({ consent }: { consent: Consent | null }) {
  const path = usePathname();

  useEffect(() => {
    if (consent === "yes") start();
    else stop();
  }, [consent]);

  if (!analyticsConfigured() || consent !== null || path === "/privacy") return null;
  const t = copy.consent;

  return (
    <div
      role="region"
      aria-label={t.label}
      className="pop fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-tile bg-surface p-4 shadow-tile sm:inset-x-6 sm:p-5"
    >
      <p className="text-[0.9rem] leading-relaxed text-ink-2">
        {t.body}{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-2">{t.more}</Link>
      </p>
      <form action={setAnalytics} className="mt-3 flex flex-wrap gap-2">
        <ChoiceButton name="analytics" value="yes" pressed={false} className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-white hover:bg-accent-deep">
          {t.accept}
        </ChoiceButton>
        <ChoiceButton name="analytics" value="no" pressed={false} className="min-h-10 rounded-full border border-rule px-5 text-[0.9rem] font-medium text-ink hover:bg-sunk">
          {t.decline}
        </ChoiceButton>
      </form>
    </div>
  );
}

/** Records one event when it renders: for outcomes only the server knows,
 *  such as a booking that really saved (the page after the redirect). */
export function TrackOnce({ event, props }: { event: string; props?: Record<string, string | number | boolean | null> }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(event, JSON.parse(key));
  }, [event, key]);
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
