import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { createClient } from "@/lib/supabase/server";
import { monthOptions } from "@/lib/trips/guided-start";
import { planTabs } from "@/lib/trips/plan-tabs";
import { READY_MADE_CITIES } from "@/lib/trips/ready-made";
import { availableReadyMade, tokyoToday } from "@/lib/trips/ready-made/start";
import type { CoverageTier } from "@/lib/types";
import { copy } from "@/copy";
import { GuidedForm } from "./guided-form";
import { PlanTabs } from "./plan-tabs";
import { ReadyMadePicker, type PickerTrip } from "./ready-made-picker";

const t = copy.trips.guided;
const r = copy.readyMade.picker;

/** "Plan a Japan trip": two tabs, a few questions for someone who has an idea
 *  but not the details yet (the default), and ready-made trips to start from
 *  (`?tab=ready-made`, read by the tabs from the address). With no
 *  ready-made trip to offer, the questions alone, without tabs. The blank form stays on the trips list. */
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

  const tabs = planTabs(trips.length);
  const months = monthOptions(new Date());
  const own = (gap: string) => (
    <>
      <p className={`${gap} text-[0.95rem] text-ink-2`}>{t.intro}</p>
      <GuidedForm months={months} />
    </>
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/trips", label: copy.common.yourTrips }} />
      <AnalyticsUser id={user.id} />
      <section className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        {tabs.length > 1 ? (
          <PlanTabs
            tabs={tabs}
            panels={{
              own: own("mt-6"),
              "ready-made": (
                <>
                  <p className="mt-6 text-[0.95rem] text-ink-2">{r.intro}</p>
                  <ReadyMadePicker trips={trips} today={tokyoToday()} />
                </>
              ),
            }}
          />
        ) : (
          own("mt-2")
        )}
      </section>
    </main>
  );
}
