import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import type { TripState } from "@/lib/bento-man/store";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { planDocument, type DocBooking } from "@/lib/trips/plan-document";
import { shareIsActive } from "@/lib/trips/share-expiry";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { SubmitButton } from "@/components/form-controls";
import { PlanSheet } from "@/components/plan/plan-sheet";
import { PrintButton } from "@/components/plan/print-button";
import { copy } from "@/copy";
import { shareTrip } from "../actions";
import { ShareExpiryField } from "../share-expiry-field";

const t = copy.print;

/** The file name a browser gives the saved PDF comes from the title. */
export async function generateMetadata({ params }: PageProps<"/trips/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("trips").select("title").eq("id", id).maybeSingle();
  return { title: { absolute: t.pageTitle(data?.title ?? copy.trips.untitled) }, robots: { index: false } };
}

/** The whole plan on one page, made to be printed or saved as a PDF and
 *  carried offline (components/plan/plan-sheet.tsx). Accepted state only,
 *  as on the trip page. Never a booking reference: this leaves Bento. */
export default async function PrintPlan({ params }: PageProps<"/trips/[id]/print">) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/sign-in?next=/trips/${id}/print`);

  // Only a trip that isn't there (or isn't theirs) is a 404. Any other
  // failed read throws to the error page, which offers a retry.
  const { data: exists, error: tripError } = await db.from("trips").select("id").eq("id", id).maybeSingle();
  if (tripError) throw new Error(t.loadFailed);
  if (!exists) notFound();
  const store = new SupabaseStore(db, id, user.id);
  const state: TripState = await store.state();

  const { dayList } = buildTripView(state, null);
  const cityIds = [...new Set(state.days.map((d) => d.cityId).filter((c): c is string => Boolean(c)))];
  // A plan saved with pieces missing looks complete offline, so a failed
  // read throws (the error page offers a retry) rather than printing less.
  const [placeLists, graph, { data: bookingRows, error: bookingsError }, { data: share }] = await Promise.all([
    Promise.all(cityIds.map((c) => store.places(c))),
    store.graph(),
    // Never the reference.
    db.from("bookings").select("id, type, title, starts_at, ends_at, starts_time_known, ends_time_known, planned_on").eq("trip_id", id),
    db.from("trip_shares").select("token, expires_at").eq("trip_id", id).maybeSingle(),
  ]);
  if (bookingsError || !bookingRows) throw new Error(t.loadFailed);
  const places = new Map(placeLists.flat().map((p) => [p.id, p]));
  const bookings: DocBooking[] = bookingRows.map((b) => ({
    id: b.id, type: b.type, title: b.title, startsAt: b.starts_at, endsAt: b.ends_at, plannedOn: b.planned_on,
    startTimeKnown: b.starts_time_known !== false, endTimeKnown: b.ends_time_known !== false,
  }));
  const doc = planDocument(state, dayList, bookings, places, graph.stations);
  const today = new Date().toISOString().slice(0, 10);
  // Shared: the companions' link, so the copy they're sent opens for them.
  // Not shared, expired (or unknown): the trip page, which opens only for its owner.
  const origin = siteOrigin(await headers());
  const link = share && shareIsActive(share, new Date())
    ? { label: t.linkShared, url: `${origin}/shared/${share.token}` }
    : { label: t.link, url: `${origin}/trips/${id}` };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12 print:max-w-none print:p-0">
      <AnalyticsUser id={user.id} />
      <div className="tile mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 p-4 print:hidden">
        <Link href={`/trips/${id}`} className="min-h-10 content-center rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk">
          {t.back}
        </Link>
        <PrintButton days={doc.days.length} bookings={doc.bookings.length} />
        <p className="basis-full text-[0.86rem] text-ink-2">{t.howTo}</p>
        {!share && (
          <form action={shareTrip} className="flex basis-full flex-wrap items-end gap-x-3 gap-y-2 border-t border-rule pt-3">
            <input type="hidden" name="tripId" value={id} />
            <input type="hidden" name="from" value="print" />
            <ShareExpiryField endDate={state.trip.endDate} />
            <p className="text-[0.86rem] text-ink-2">{copy.share.printHint}</p>
            <SubmitButton pending={copy.common.saving} className="min-h-10 rounded-full border border-rule bg-surface px-4 text-[0.86rem] font-medium hover:bg-sunk">
              {copy.share.turnOn}
            </SubmitButton>
          </form>
        )}
      </div>

      <PlanSheet trip={state.trip} doc={doc} today={today} link={link} />
    </main>
  );
}
