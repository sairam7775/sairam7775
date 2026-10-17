import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tour } from "@/components/tour/tour";
import { tourSeen } from "@/components/tour/seen";
import { AppHeader } from "@/components/app-header";
import { ConfirmButton, DateRangeInputs, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { createTrip, deleteTrip } from "./actions";
import { ErrorNote } from "../(auth)/ui";
import { copy } from "@/copy";

const t = copy.trips;

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return t.noDates;
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
    return `${fmt(start)} – ${fmt(end)} · ${t.nights(nights)}`;
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
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader />
      <Tour id="trips" seen={await tourSeen("trips")} />

      <h1 className="mt-8 text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-2 text-[0.95rem] text-ink-2">
        {t.signedInAs} <span className="mono break-all text-[0.85rem]">{user?.email}</span>
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
                  <Link href={`/trips/${trip.id}`} className="underline-offset-4 hover:underline">{trip.title ?? t.untitled}</Link>
                </h2>
                <p className="mono mt-1 text-[0.78rem] text-ink-3">
                  {formatRange(trip.start_date, trip.end_date)}
                  {trip.party_size > 1 && ` · ${t.people(trip.party_size)}`}
                </p>
              </div>
              <form action={deleteTrip}>
                <input type="hidden" name="id" value={trip.id} />
                <ConfirmButton
                  message={t.deleteConfirm(trip.title ?? t.untitled)}
                  aria-label={t.deleteLabel(trip.title ?? t.untitled)}
                  className="min-h-9 rounded-full px-3 text-[0.8rem] text-ink-3 hover:bg-ume-soft hover:text-ume"
                >
                  {t.delete}
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tile up px-5 py-8 text-center text-[0.95rem] text-ink-2">
          {t.empty}
        </p>
      )}

      <section data-tour="new-trip" className="tile up mt-10 p-6" style={{ animationDelay: ".15s" }}>
        <h2 className="text-lg font-bold">{t.new.title}</h2>
        <p className="mt-1 text-[0.9rem] text-ink-2">{t.new.body}</p>
        <form action={createTrip} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="title"
              className={fieldLabel}
            >
              {t.new.name}
            </label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder={t.new.namePlaceholder}
              className={fieldInput}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DateRangeInputs startLabel={t.new.arrive} endLabel={t.new.leave} labelClass={fieldLabel} inputClass={fieldInput} />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="partySize"
                className={fieldLabel}
              >
                {t.new.people}
              </label>
              <input
                id="partySize"
                name="partySize"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className={fieldInput}
              />
            </div>
          </div>

          <SubmitButton
            pending={t.new.pending}
            className="mt-1 self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep"
          >
            {t.new.submit}
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
