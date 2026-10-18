import { requireAdmin } from "@/lib/admin";
import { AppHeader } from "@/components/app-header";
import { CHALLENGES, OUTCOMES, reviewFromRow, type TripReview } from "@/lib/trips/review";
import { copy } from "@/copy";

const r = copy.review;

interface Row {
  trip_id: string;
  outcome: string;
  challenges: string[] | null;
  hard_days: string[] | null;
  note: string | null;
  updated_at: string;
  trips: { start_date: string | null; end_date: string | null; party_size: number; trip_cities: { nights: number; sort_order: number; cities: { name: string } | null }[] } | null;
}

interface DayRow {
  trip_id: string;
  date: string;
  cities: { name: string } | null;
  itinerary_items: { sort_order: number; start_time: string | null; places: { name: string } | null }[];
}

const OUTCOME_STYLE: Record<TripReview["outcome"], string> = {
  as_planned: "bg-edamame-soft text-edamame",
  mostly: "bg-tamago-soft text-tamago",
  not_really: "bg-ume-soft text-ume",
};

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** What travellers said after their trips (0019): the planner's report
 *  card. The route and the stops of every day they found hard sit next to
 *  the answer, so a failure can be traced to the plan that caused it. No
 *  names or emails: the trip is enough to find the problem. */
export default async function TripReviews() {
  const { db } = await requireAdmin();

  const { data } = await db
    .from("trip_reviews")
    .select("trip_id, outcome, challenges, hard_days, note, updated_at, trips(start_date, end_date, party_size, trip_cities(nights, sort_order, cities(name)))")
    .order("updated_at", { ascending: false })
    .limit(200);
  const rows = ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const review = reviewFromRow(row);
    return review ? [{ row, review }] : [];
  });

  const ids = rows.filter(({ review }) => review.hardDays.length).map(({ row }) => row.trip_id);
  const { data: dayData } = ids.length
    ? await db.from("itinerary_days").select("trip_id, date, cities(name), itinerary_items(sort_order, start_time, places(name))").in("trip_id", ids)
    : { data: [] };
  const days = new Map(((dayData ?? []) as unknown as DayRow[]).map((d) => [`${d.trip_id}|${d.date}`, d]));

  const count = <K extends string>(keys: readonly K[], pick: (v: TripReview) => K[]) =>
    keys.map((k) => [k, rows.filter(({ review }) => pick(review).includes(k)).length] as const);
  const outcomes = count(OUTCOMES, (v) => [v.outcome]);
  const challenges = count(CHALLENGES, (v) => v.challenges).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/admin", label: "Curation" }}>
        <span className="mono rounded-full bg-sunk px-3 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-ink-2">Admin</span>
      </AppHeader>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Trip reviews</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        What travellers said after their trips: whether they could follow the plan, and what got in the way.
      </p>

      {rows.length === 0 ? (
        <p className="tile mt-8 px-5 py-8 text-center text-[0.95rem] text-ink-2">No reviews yet. They appear once a trip has ended and the traveller answers.</p>
      ) : (
        <>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-y border-rule py-4">
            {[["Reviews", rows.length] as const, ...outcomes.map(([k, n]) => [r.outcomes[k], n] as const)].map(([label, value]) => (
              <div key={label}>
                <dt className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">{label}</dt>
                <dd className="mono mt-0.5 text-lg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8">
            <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">What got in the way</h2>
            <ul className="mt-3 flex flex-col">
              {challenges.map(([k, n]) => (
                <li key={k} className="flex items-baseline justify-between gap-4 border-b border-rule py-2 text-[0.92rem]">
                  <span>{r.challenges[k]}</span>
                  <span className="mono tabular-nums text-ink-3">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">Every answer</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {rows.map(({ row, review }) => {
                const trip = row.trips;
                const route = [...(trip?.trip_cities ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((c) => `${c.cities?.name ?? "?"} ${c.nights}n`).join(" → ");
                return (
                  <li key={row.trip_id} className="tile p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className={`mono rounded-[3px] px-1.5 py-0.5 text-[0.66rem] uppercase tracking-[0.08em] ${OUTCOME_STYLE[review.outcome]}`}>{r.outcomes[review.outcome]}</span>
                      <span className="mono text-[0.72rem] text-ink-3">
                        {trip?.start_date && trip.end_date ? `${fmt(trip.start_date)} – ${fmt(trip.end_date)}` : "No dates"}
                        {trip && trip.party_size > 1 ? ` · ${trip.party_size} people` : ""} · answered {fmt(row.updated_at.slice(0, 10))}
                      </span>
                    </div>
                    {route && <p className="mono mt-2 text-[0.8rem] text-ink-2">{route}</p>}
                    {review.challenges.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {review.challenges.map((c) => (
                          <li key={c} className="rounded-full bg-sunk px-2.5 py-1 text-[0.8rem] text-ink-2">{r.challenges[c]}</li>
                        ))}
                      </ul>
                    )}
                    {review.hardDays.length > 0 && (
                      <div className="mt-3">
                        <p className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">Hardest days</p>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {review.hardDays.map((date) => {
                            const d = days.get(`${row.trip_id}|${date}`);
                            const stops = [...(d?.itinerary_items ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => `${i.start_time?.slice(0, 5) ?? "--:--"} ${i.places?.name ?? "?"}`);
                            return (
                              <li key={date} className="text-[0.86rem]">
                                <span className="font-medium">{fmt(date)}{d?.cities?.name ? ` · ${d.cities.name}` : ""}</span>
                                <span className="text-ink-3">{stops.length ? ` — ${stops.join(", ")}` : " — no stops planned"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {review.note && <p className="mt-3 whitespace-pre-line text-[0.92rem] leading-relaxed">{review.note}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
