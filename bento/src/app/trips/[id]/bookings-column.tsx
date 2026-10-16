"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import { bookingDates, canPlanOn } from "@/lib/vault/plan-day";

/** A booking as the trip page shows it. Never the reference: that is
 *  decrypted only on the vault page, for its owner. */
export interface PlanBooking {
  id: string;
  type: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  /** False when only a date was given. */
  startTimeKnown: boolean;
  endTimeKnown: boolean;
  plannedOn: string | null;
}

export const BOOKING_DRAG = "application/x-bento-booking";

export const KIND_LABEL: Record<string, string> = {
  flight: "Flight",
  accommodation: "Stay",
  transport: "Transport",
  activity: "Ticket",
  restaurant: "Restaurant",
  other: "Booking",
};

export const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function whenText(b: PlanBooking): string {
  const r = bookingDates(b);
  if (!r) return "No date yet";
  return r.first === r.last ? shortDate(r.first) : `${shortDate(r.first)} – ${shortDate(r.last)}`;
}

/** The Bookings column beside a day's box. Each booking says where it
 *  stands for this day: in it, on another day, ready to add, or for a
 *  different date (and so refused here). Drag works with a mouse; "Add to
 *  this day" is the same thing for a phone or a keyboard. */
export function BookingsColumn({
  tripId, date, bookings, tripDays, busy, message, onAdd, onRemove, onDragStart, onDragEnd,
}: {
  tripId: string;
  date: string;
  bookings: PlanBooking[];
  tripDays: string[];
  busy: boolean;
  message: { tone: "error" | "ok"; text: string } | null;
  onAdd: (b: PlanBooking) => void;
  onRemove: (b: PlanBooking) => void;
  onDragStart: (b: PlanBooking, e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const sorted = [...bookings].sort((a, b) => (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"));

  return (
    <div className="tile up px-4 py-4" style={{ animationDelay: ".24s" }} aria-busy={busy}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">Bookings</span>
        <Link href={`/trips/${tripId}/vault`} className="text-[0.78rem] font-medium text-accent hover:underline">All bookings →</Link>
      </div>
      <p className="mt-1.5 text-[0.8rem] leading-snug text-ink-3">
        Drag one into the day, or tap Add. Only bookings for {shortDate(date)} fit in this day.
      </p>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-2.5 rounded-lg px-3 py-2 text-[0.8rem] leading-snug ${message.tone === "error" ? "bg-ume-soft text-ume" : "bg-edamame-soft text-ink-2"}`}>
          {message.text}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="mt-3 text-[0.84rem] leading-snug text-ink-2">
          No bookings yet. Add flights, hotels and tickets in <Link href={`/trips/${tripId}/vault`} className="text-accent underline underline-offset-2">Bookings</Link>, then put them in their day.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {sorted.map((b) => {
            const fits = canPlanOn(b, date);
            // A booking in the plan sits in every day it covers, so "here" is
            // simply: planned, and this day is one of its dates.
            const planned = b.plannedOn != null;
            const here = planned && fits;
            const range = bookingDates(b);
            const firstDayInPlan = range ? tripDays.find((d) => d >= range.first && d <= range.last) ?? null : null;
            return (
              <li
                key={b.id}
                draggable={Boolean(range) && !planned && !busy}
                onDragStart={(e) => onDragStart(b, e)}
                onDragEnd={onDragEnd}
                className={`rounded-xl border px-3 py-2.5 ${here ? "border-accent/60 bg-accent-soft" : "border-rule bg-surface"} ${range && !planned ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-3">{KIND_LABEL[b.type] ?? "Booking"}</span>
                  <span className={`mono ml-auto text-[0.66rem] ${fits || !range ? "text-ink-3" : "text-ume"}`}>{whenText(b)}</span>
                </div>
                <p className="mt-0.5 text-[0.88rem] font-medium leading-snug">{b.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.76rem]">
                  {here ? (
                    <>
                      <span className="inline-flex min-h-10 items-center text-ink-2">In this day</span>
                      <button type="button" disabled={busy} onClick={() => onRemove(b)} className="ml-auto min-h-10 rounded-full px-2.5 text-ink-3 hover:bg-ume-soft hover:text-ume disabled:opacity-50">Take out</button>
                    </>
                  ) : !range ? (
                    <Link href={`/trips/${tripId}/vault`} className="inline-flex min-h-10 items-center text-accent underline underline-offset-2">Add a date to plan it</Link>
                  ) : fits ? (
                    <button type="button" disabled={busy} onClick={() => onAdd(b)} className="ml-auto min-h-10 rounded-full border border-rule px-3 font-medium text-ink hover:bg-sunk disabled:opacity-50">
                      Add to this day
                    </button>
                  ) : planned && firstDayInPlan ? (
                    <Link href={`/trips/${tripId}?day=${firstDayInPlan}`} className="inline-flex min-h-10 items-center text-ink-3 underline underline-offset-2">In the plan · open {shortDate(firstDayInPlan)}</Link>
                  ) : firstDayInPlan ? (
                    <Link href={`/trips/${tripId}?day=${firstDayInPlan}`} className="inline-flex min-h-10 items-center text-ink-3 underline underline-offset-2">Not this day · open {shortDate(firstDayInPlan)}</Link>
                  ) : (
                    <span className="inline-flex min-h-10 items-center text-ink-3">Outside this trip&rsquo;s days</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
