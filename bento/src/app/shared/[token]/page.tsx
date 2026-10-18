import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { planDocument } from "@/lib/trips/plan-document";
import { sharedPlanFromJson } from "@/lib/trips/shared-plan";
import { BentoLogo } from "@/components/logo";
import { PlanSheet } from "@/components/plan/plan-sheet";
import { PrintButton } from "@/components/plan/print-button";
import { copy } from "@/copy";

const TOKEN = /^[0-9a-f]{32}$/;

/** The plan behind a link (0020 shared_trip), once per request: the title
 *  and the page both need it. Null when no trip is shared under it. */
const loadShared = cache(async (token: string) => {
  if (!TOKEN.test(token)) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("shared_trip", { p_token: token });
  if (error) throw new Error(copy.share.loadFailed);
  if (data == null) return null;
  // A plan that doesn't read is Bento's fault, not a switched-off link.
  const plan = sharedPlanFromJson(data);
  if (!plan) throw new Error(copy.share.loadFailed);
  return plan;
});

export async function generateMetadata({ params }: PageProps<"/shared/[token]">): Promise<Metadata> {
  const { token } = await params;
  const plan = await loadShared(token).catch(() => null);
  return {
    title: { absolute: copy.print.pageTitle(plan?.state.trip.title ?? copy.trips.untitled) },
    robots: { index: false, follow: false },
    // The address is the key to the plan: never send it on as a referrer.
    referrer: "no-referrer",
  };
}

/** A trip shared by link with the people travelling. No account needed:
 *  the token is the key, and the plan comes from shared_trip() alone. It is
 *  the download's sheet (PlanSheet), always current, read-only. No
 *  analytics run here (components/analytics). */
export default async function SharedPlanPage({ params }: PageProps<"/shared/[token]">) {
  const { token } = await params;
  const plan = await loadShared(token);
  if (!plan) notFound();

  // The traveller opening their own link: RLS shows a trip only to its owner.
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: own } = user ? await db.from("trips").select("id").eq("id", plan.state.trip.id).maybeSingle() : { data: null };

  const { dayList } = buildTripView(plan.state, null);
  const doc = planDocument(plan.state, dayList, plan.bookings, plan.places, plan.stations);
  const today = new Date().toISOString().slice(0, 10);
  const url = `${siteOrigin(await headers())}/shared/${token}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12 print:max-w-none print:p-0">
      <header className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/" className="inline-flex" aria-label={copy.common.homeLabel}>
          <BentoLogo />
        </Link>
      </header>
      <div className="tile mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 p-4 print:hidden">
        <p className="basis-full text-[0.92rem] text-ink-2">{own ? copy.share.ownerNote : copy.share.viewerNote}</p>
        {own && (
          <Link href={`/trips/${own.id}`} className="min-h-10 content-center rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk">
            {copy.share.backToTrip}
          </Link>
        )}
        <PrintButton days={doc.days.length} bookings={doc.bookings.length} />
        <p className="basis-full text-[0.86rem] text-ink-2">{copy.print.howTo}</p>
      </div>

      <PlanSheet trip={plan.state.trip} doc={doc} today={today} link={{ label: copy.print.linkShared, url }} companion />
    </main>
  );
}
