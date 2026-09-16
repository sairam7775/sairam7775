"use client";

import { useState, type FormEvent } from "react";
import type { BookingKind } from "@/lib/types";
import { saveBooking } from "./actions";

const KINDS: { id: BookingKind; label: string; hint: string }[] = [
  { id: "accommodation", label: "Somewhere to sleep", hint: "Hotel, ryokan, hostel, apartment" },
  { id: "flight", label: "Flight", hint: "Getting in and out of Japan" },
  { id: "transport", label: "Between cities", hint: "Shinkansen, bus, ferry" },
  { id: "activity", label: "Ticket", hint: "Timed entry, tour, museum" },
  { id: "restaurant", label: "Table", hint: "A reservation" },
  { id: "other", label: "Other", hint: "Anything else" },
];

export interface CityOption {
  id: string;
  name: string;
}

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => (
  <label htmlFor={htmlFor} className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{children}</label>
);

const field = "rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.92rem]";

/** Add a booking by typing it, or paste the confirmation and let it fill
 *  the form in. The paste never saves anything: every field is reviewed. */
export function BookingForm({ tripId, cities, defaultType, defaultDate }: { tripId: string; cities: CityOption[]; defaultType?: string; defaultDate?: string }) {
  const [type, setType] = useState<BookingKind>((KINDS.find((k) => k.id === defaultType)?.id ?? "accommodation") as BookingKind);
  const [open, setOpen] = useState(Boolean(defaultType));
  const [paste, setPaste] = useState("");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [values, setValues] = useState({
    title: "", provider: "", reference: "",
    startsAt: defaultDate ? `${defaultDate}T15:00` : "", endsAt: "",
    costAmount: "", costCurrency: "", notes: "",
  });
  const set = (k: keyof typeof values, v: string) => setValues((s) => ({ ...s, [k]: v }));

  async function read(e: FormEvent) {
    e.preventDefault();
    if (!paste.trim() || reading) return;
    setReading(true);
    setReadError(null);
    try {
      const res = await fetch("/api/parse-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: paste }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that.");
      setType(body.values.type);
      setValues({
        title: body.values.title, provider: body.values.provider, reference: body.values.reference,
        startsAt: body.values.startsAt, endsAt: body.values.endsAt,
        costAmount: body.values.costAmount, costCurrency: body.values.costCurrency, notes: body.values.notes,
      });
      setPaste("");
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read that.");
    } finally {
      setReading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-accent px-5 py-2.5 text-[0.88rem] font-medium text-white hover:bg-accent-deep">
        Add a booking
      </button>
    );
  }

  const needsRoute = type === "transport" || type === "flight";

  return (
    <div className="tile up w-full p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="disp text-[1.15rem] font-bold">Add a booking</h2>
        <button onClick={() => setOpen(false)} className="mono text-[0.64rem] uppercase tracking-[0.08em] text-ink-3 underline underline-offset-2">Close</button>
      </div>

      <div className="mt-4 rounded-xl bg-sunk p-3.5">
        <Label htmlFor="paste">Paste the confirmation</Label>
        <textarea
          id="paste"
          rows={3}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Paste the whole email. It fills the form in below; nothing is saved until you press Save."
          className={`${field} mt-1.5 w-full resize-y`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button onClick={read} disabled={reading || !paste.trim()} className="rounded-full bg-lacquer px-4 py-1.5 text-[0.82rem] font-medium text-rice disabled:opacity-50">
            {reading ? "Reading…" : "Read it"}
          </button>
          <span className="mono text-[0.62rem] leading-snug text-ink-3">Read in a separate call with no access to your trip. Check every field before saving.</span>
        </div>
        {readError && <p className="mt-2 border-l-[3px] border-ume bg-ume-soft px-3 py-2 text-[0.82rem] text-ink-2">{readError}</p>}
      </div>

      <form action={saveBooking} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="tripId" value={tripId} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">What is it</Label>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setType(k.id)}
                title={k.hint}
                className={`rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium ${type === k.id ? "bg-lacquer text-rice" : "border border-rule bg-paper text-ink-2"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <input type="hidden" id="type" name="type" value={type} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Name it</Label>
            <input id="title" name="title" required value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="Hotel Kanra Kyoto" className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider">Who with</Label>
            <input id="provider" name="provider" value={values.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Booking.com, ANA, JR West" className={field} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startsAt">{type === "accommodation" ? "Check in" : "Starts"}</Label>
            <input id="startsAt" name="startsAt" type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endsAt">{type === "accommodation" ? "Check out" : "Ends"}</Label>
            <input id="endsAt" name="endsAt" type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={field} />
          </div>
        </div>

        {cities.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cityId">{needsRoute ? "From" : "Where"}</Label>
              <select id="cityId" name="cityId" defaultValue="" className={field}>
                <option value="">Not tied to a city</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {needsRoute && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="toCityId">To</Label>
                <select id="toCityId" name="toCityId" defaultValue="" className={field}>
                  <option value="">—</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference">Booking reference</Label>
            <input id="reference" name="reference" value={values.reference} onChange={(e) => set("reference", e.target.value)} placeholder="ABC123" autoComplete="off" className={field} />
            <span className="mono text-[0.6rem] leading-snug text-ink-3">Encrypted before it is stored. Never logged, never sent to Bento Man.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costAmount">Cost</Label>
            <input id="costAmount" name="costAmount" inputMode="decimal" value={values.costAmount} onChange={(e) => set("costAmount", e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costCurrency">Currency</Label>
            <input id="costCurrency" name="costCurrency" maxLength={3} value={values.costCurrency} onChange={(e) => set("costCurrency", e.target.value.toUpperCase())} placeholder="JPY" className={`${field} uppercase`} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Anything else</Label>
          <input id="notes" name="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Non-refundable after 14 Nov" className={field} />
        </div>

        <button type="submit" className="mt-1 self-start rounded-full bg-accent px-5 py-2.5 text-[0.88rem] font-medium text-white hover:bg-accent-deep">
          Save it
        </button>
      </form>
    </div>
  );
}
