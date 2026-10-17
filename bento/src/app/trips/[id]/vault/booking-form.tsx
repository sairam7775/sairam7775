"use client";

import { useState, type FormEvent } from "react";
import type { BookingKind } from "@/lib/types";
import { saveBooking } from "./actions";
import { DateInput } from "@/components/form-controls";
import { copy } from "@/copy";
import { reasonOf, track } from "@/lib/analytics/client";

const t = copy.vault.form;

// Shown in this order; the words are in copy.vault.form.kinds.
const KINDS: { id: BookingKind; label: string; hint: string }[] = (
  ["accommodation", "flight", "transport", "activity", "restaurant", "other"] as const
).map((id) => ({ id, ...t.kinds[id] }));

export interface CityOption {
  id: string;
  name: string;
}

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => (
  <label htmlFor={htmlFor} className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{children}</label>
);

const field = "rounded-xl border border-rule bg-paper px-3 py-2.5 text-[0.92rem]";

/** A date, and a time if there is one. The value is "YYYY-MM-DD" or
 *  "YYYY-MM-DDTHH:MM", sent as one field (`name`); a date with no time is
 *  saved as a date alone and never shown as midnight. A pasted confirmation
 *  that gave no time leaves the time empty and says so. */
function WhenField({ name, label, value, onChange, minDate, timeHint }: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  timeHint?: string;
}) {
  const [date, time = ""] = value.split("T");
  const join = (d: string, tm: string) => (d ? (tm ? `${d}T${tm}` : d) : "");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${name}-date`}>{label}</Label>
      <div className="flex gap-2">
        <DateInput id={`${name}-date`} type="date" min={minDate || undefined} value={date ?? ""} onChange={(e) => onChange(join(e.target.value, time))} className={`${field} min-w-0 flex-1`} />
        <input
          id={`${name}-time`}
          type="time"
          aria-label={t.timeLabel(label)}
          value={time}
          disabled={!date}
          onChange={(e) => onChange(join(date, e.target.value))}
          className={`${field} w-[7.5rem] shrink-0 disabled:opacity-50`}
        />
      </div>
      {date && !time && <span className="text-[0.76rem] text-ink-3">{timeHint ?? t.noTime}</span>}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** Add a booking by typing it, or paste the confirmation and let it fill
 *  the form in. The paste never saves anything: every field is reviewed. */
/** `defaultPlaceId` / `defaultTitle` come from a ticket gap's "Add a booking":
 *  the booking is saved linked to that place, so the gap detector and the
 *  planner both see the ticket as held (lib/vault/match.ts). */
export function BookingForm({ tripId, cities, defaultType, defaultDate, defaultPlaceId, defaultTitle }: { tripId: string; cities: CityOption[]; defaultType?: string; defaultDate?: string; defaultPlaceId?: string; defaultTitle?: string }) {
  const [type, setType] = useState<BookingKind>((KINDS.find((k) => k.id === defaultType)?.id ?? "accommodation") as BookingKind);
  const [open, setOpen] = useState(Boolean(defaultType));
  const [paste, setPaste] = useState("");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  // Set when a pasted confirmation gave a date but no time, to say so.
  const [noTimeFromPaste, setNoTimeFromPaste] = useState({ startsAt: false, endsAt: false });
  // Whether the form was filled from a pasted confirmation, for analytics.
  const [fromPaste, setFromPaste] = useState(false);
  const [values, setValues] = useState({
    title: defaultTitle ?? "", provider: "", reference: "",
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
      if (!res.ok) throw new Error(body.error ?? t.readFailed);
      setType(body.values.type);
      setNoTimeFromPaste({
        startsAt: Boolean(body.values.startsAt) && !body.values.startsAt.includes("T"),
        endsAt: Boolean(body.values.endsAt) && !body.values.endsAt.includes("T"),
      });
      setValues({
        title: body.values.title, provider: body.values.provider, reference: body.values.reference,
        startsAt: body.values.startsAt, endsAt: body.values.endsAt,
        costAmount: body.values.costAmount, costCurrency: body.values.costCurrency, notes: body.values.notes,
      });
      setPaste("");
      setFromPaste(true);
      track("confirmation_read", { ok: true, type: body.values.type, has_time: Boolean(body.values.startsAt?.includes("T")) });
    } catch (err) {
      setReadError(err instanceof Error ? err.message : t.readFailed);
      track("confirmation_read", { ok: false, reason: err instanceof Error ? reasonOf(err.message, copy.server) : "other" });
    } finally {
      setReading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full bg-accent px-5 py-2.5 text-[0.88rem] font-medium text-white hover:bg-accent-deep">
        {t.open}
      </button>
    );
  }

  const needsRoute = type === "transport" || type === "flight";

  return (
    <div className="tile up w-full p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="disp text-[1.15rem] font-bold">{t.title}</h2>
        <button onClick={() => setOpen(false)} className="mono text-[0.64rem] uppercase tracking-[0.08em] text-ink-3 underline underline-offset-2">{t.close}</button>
      </div>

      <div className="mt-4 rounded-xl bg-sunk p-3.5">
        <Label htmlFor="paste">{t.paste}</Label>
        <textarea
          id="paste"
          rows={3}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={t.pastePlaceholder}
          className={`${field} mt-1.5 w-full resize-y`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button onClick={read} disabled={reading || !paste.trim()} className="rounded-full bg-lacquer px-4 py-1.5 text-[0.82rem] font-medium text-rice disabled:opacity-50">
            {reading ? t.reading : t.read}
          </button>
          <span className="mono text-[0.62rem] leading-snug text-ink-3">{t.readNote}</span>
        </div>
        {readError && <p className="mt-2 border-l-[3px] border-ume bg-ume-soft px-3 py-2 text-[0.82rem] text-ink-2">{readError}</p>}
      </div>

      <form action={saveBooking} onSubmit={() => track("booking_save_submitted", { type, from_paste: fromPaste })} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="tripId" value={tripId} />
        {defaultPlaceId && <input type="hidden" name="placeId" value={defaultPlaceId} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">{t.kind}</Label>
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
            <Label htmlFor="title">{t.name}</Label>
            <input id="title" name="title" required value={values.title} onChange={(e) => set("title", e.target.value)} placeholder={t.namePlaceholder} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider">{t.provider}</Label>
            <input id="provider" name="provider" value={values.provider} onChange={(e) => set("provider", e.target.value)} placeholder={t.providerPlaceholder} className={field} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <WhenField
            name="startsAt"
            label={type === "accommodation" ? t.checkIn : t.starts}
            value={values.startsAt}
            onChange={(v) => set("startsAt", v)}
            timeHint={noTimeFromPaste.startsAt ? t.noTimeFromPaste : undefined}
          />
          <WhenField
            name="endsAt"
            label={type === "accommodation" ? t.checkOut : t.ends}
            value={values.endsAt}
            onChange={(v) => set("endsAt", v)}
            minDate={values.startsAt.slice(0, 10)}
            timeHint={noTimeFromPaste.endsAt ? t.noTimeFromPaste : undefined}
          />
        </div>

        {cities.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cityId">{needsRoute ? t.from : t.where}</Label>
              <select id="cityId" name="cityId" defaultValue="" className={field}>
                <option value="">{t.noCity}</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {needsRoute && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="toCityId">{t.to}</Label>
                <select id="toCityId" name="toCityId" defaultValue="" className={field}>
                  <option value="">{copy.time.none}</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference">{t.reference}</Label>
            <input id="reference" name="reference" value={values.reference} onChange={(e) => set("reference", e.target.value)} placeholder={t.referencePlaceholder} autoComplete="off" className={field} />
            <span className="mono text-[0.6rem] leading-snug text-ink-3">{t.referenceNote}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costAmount">{t.cost}</Label>
            <input id="costAmount" name="costAmount" inputMode="decimal" value={values.costAmount} onChange={(e) => set("costAmount", e.target.value)} className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costCurrency">{t.currency}</Label>
            <input id="costCurrency" name="costCurrency" maxLength={3} value={values.costCurrency} onChange={(e) => set("costCurrency", e.target.value.toUpperCase())} placeholder={t.currencyPlaceholder} className={`${field} uppercase`} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">{t.notes}</Label>
          <input id="notes" name="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t.notesPlaceholder} className={field} />
        </div>

        <button type="submit" className="mt-1 self-start rounded-full bg-accent px-5 py-2.5 text-[0.88rem] font-medium text-white hover:bg-accent-deep">
          {t.save}
        </button>
      </form>
    </div>
  );
}
