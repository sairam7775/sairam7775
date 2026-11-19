import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { createClient } from "@/lib/supabase/server";
import { monthOptions } from "@/lib/trips/guided-start";
import { READY_MADE_CITIES } from "@/lib/trips/ready-made";
import { availableReadyMade } from "@/lib/trips/ready-made/start";
import type { CoverageTier } from "@/lib/types";
import { copy } from "@/copy";
import { GuidedForm } from "./guided-form";
import { ReadyMadePicker, type PickerTrip } from "./ready-made-picker";

const t = copy.trips.guided;
const r = copy.readyMade.picker;

/** "Plan a Japan trip": a few questions for someone who has an idea but not
 *  the details yet, and beside them, ready-made trips to start from. The
 *  blank form stays on the trips list. */
export default async function PlanATrip() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/trips/plan");

  // Only trips whose every city is planned (city_coverage, the
  // traveller-safe view). If coverage can't be read, none are offered.
  const { data: coverage, error } = await supabase.from("city_coverage").select("city_id, coverage_tier").in("city_id", [...READY_MADE_CITIES]);
  if (error) console.error("Reading coverage for ready-made trips failed:", error.message);
  const tiers = new Map((coverage ?? []).map((c) => [c.city_id as string, c.coverage_tier as CoverageTier]));
  const trips: PickerTrip[] = availableReadyMade(tiers).map((x) => ({
    id: x.id,
    days: x.days,
    title: copy.readyMade.trips[x.id].title,
    summary: copy.readyMade.trips[x.id].summary,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/trips", label: copy.common.yourTrips }} />
      <AnalyticsUser id={user.id} />
      <section className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-[0.95rem] text-ink-2">{t.intro}</p>
        <GuidedForm months={monthOptions(new Date())} />
      </section>
      {trips.length > 0 && (
        <section aria-labelledby="ready-made-title" className="tile up mt-6 p-6 sm:p-8">
          <h2 id="ready-made-title" className="text-2xl font-bold tracking-tight">{r.title}</h2>
          <p className="mt-2 text-[0.95rem] text-ink-2">{r.intro}</p>
          <ReadyMadePicker trips={trips} today={new Date().toISOString().slice(0, 10)} />
        </section>
      )}
    </main>
  );
}
