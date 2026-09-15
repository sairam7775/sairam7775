import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo } from "@/components/logo";
import { signOut } from "../(auth)/actions";
import { createTrip, deleteTrip } from "./actions";
import { ErrorNote } from "../(auth)/ui";

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return "No dates yet";
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  if (start && end) {
    const nights = Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
    );
    return `${fmt(start)} – ${fmt(end)} · ${nights} night${nights === 1 ? "" : "s"}`;
  }
  return fmt((start ?? end)!);
}

export default async function Trips({ searchParams }: PageProps<"/trips">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, start_date, end_date, party_size, status")
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href="/" className="inline-flex" aria-label="Bento home">
          <BentoLogo />
        </Link>
        <form action={signOut}>
          <button className="mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3 underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight">Your trips</h1>
      <p className="mt-2 text-[0.95rem] text-ink-2">
        Signed in as <span className="mono text-[0.85rem]">{user?.email}</span>
      </p>

      <div className="mt-8">
        <ErrorNote message={error} />
      </div>

      {trips && trips.length > 0 ? (
        <ul className="box flex flex-col gap-2.5 p-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="tile lift up flex items-start justify-between gap-4 px-5 py-4"
            >
              <div>
                <h2 className="text-base font-bold">
                  <Link href={`/trips/${trip.id}`} className="underline-offset-4 hover:underline">{trip.title ?? "Untitled trip"}</Link>
                </h2>
                <p className="mono mt-1 text-[0.78rem] text-ink-3">
                  {formatRange(trip.start_date, trip.end_date)}
                  {trip.party_size > 1 && ` · ${trip.party_size} people`}
                </p>
              </div>
              <form action={deleteTrip}>
                <input type="hidden" name="id" value={trip.id} />
                <button className="mono text-[0.68rem] uppercase tracking-[0.08em] text-ink-3 underline underline-offset-2">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tile up px-5 py-8 text-center text-[0.95rem] text-ink-2">
          No trips yet. Start one below — dates can come later.
        </p>
      )}

      <section className="tile up mt-10 p-6" style={{ animationDelay: ".15s" }}>
        <h2 className="text-lg font-bold">Start a trip</h2>
        <form action={createTrip} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="title"
              className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3"
            >
              Name it
            </label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="Kansai, autumn"
              className="rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.95rem]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="startDate"
                className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3"
              >
                Arrive
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.95rem]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="endDate"
                className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3"
              >
                Leave
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.95rem]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="partySize"
                className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3"
              >
                Travelling
              </label>
              <input
                id="partySize"
                name="partySize"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className="rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.95rem]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep"
          >
            Create trip
          </button>
        </form>
      </section>
    </main>
  );
}
