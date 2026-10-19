import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { createClient } from "@/lib/supabase/server";
import { monthOptions } from "@/lib/trips/guided-start";
import { copy } from "@/copy";
import { GuidedForm } from "./guided-form";

const t = copy.trips.guided;

/** "Plan a Japan trip": a few questions for someone who has an idea but not
 *  the details yet. The blank form stays on the trips list. */
export default async function PlanATrip() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/trips/plan");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/trips", label: copy.common.yourTrips }} />
      <AnalyticsUser id={user.id} />
      <section className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-[0.95rem] text-ink-2">{t.intro}</p>
        <GuidedForm months={monthOptions(new Date())} />
      </section>
    </main>
  );
}
