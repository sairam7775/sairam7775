"use client";

import { useOptimistic, useRef, useState, useTransition, type DragEvent } from "react";
import { moveItem, removeItem, reorderDay, replanDayAction, togglePin } from "./day-actions";
import { planBooking, unplanBooking } from "./booking-actions";
import { BOOKING_DRAG, BookingsColumn, KIND_LABEL, shortDate, whenText, type PlanBooking } from "./bookings-column";
import { ConfirmButton } from "@/components/form-controls";
import { bookingSlot, canPlanOn, clashingBookings } from "@/lib/vault/plan-day";
import { copy } from "@/copy";
import { track } from "@/lib/analytics/client";

const t = copy.day;
const bk = copy.bookings;

export interface DayBoxItem {
  placeId: string;
  name: string;
  startMin: number | null;
  durationMin: number | null;
  locked: boolean;
  reason: string | null;
  reasonTerms: string[];
  arriveMode: string | null;
  arriveMinutes: number | null;
  arriveDetail: string | null;
}

export interface DayBoxProps {
  tripId: string;
  date: string;
  cityId: string;
  cityName: string;
  /** How well the city is covered, in words. */
  tier: string;
  items: DayBoxItem[];
  budgetMin: number;
  activeMin: number;
  overBy: number;
  overFromIndex: number | null;
  lunch: { startMin: number; endMin: number } | null;
  editable: boolean;
  /** A city Bento can't plan days in yet: the box says so, rather than
   *  inviting the traveller to ask for stops that can't come. */
  uncovered?: boolean;
  /** Every booking in the trip, for the Bookings column; the ones planned
   *  on this date also sit in the box. */
  bookings: PlanBooking[];
  /** The plan's dates, so a booking for another day can link to it. */
  tripDays: string[];
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dur = copy.time.duration;

/** Compartment colours cycle through the box: salmon, edamame, lavender,
 *  tamago, plain. Enough to tell stops apart at a glance, never a code. */
const FILLS = ["bg-accent-soft", "bg-edamame-soft", "bg-lavender-soft", "bg-tamago-soft", "bg-surface"];
/** Height is time. 1.05px a minute, floored so a 15-minute stop is still readable. */
const PX_PER_MIN = 1.05;
const MIN_TILE = 88;

const TERM_LABEL: Record<string, string> = t.reasons;

/** A day is a bento box. Compartments are sized to the time each stop
 *  takes, so an over-packed day looks over-packed before you read a word.
 *  Drag reorders; pin and remove apply at once and the engine re-times
 *  the day. Re-plan asks the engine to choose again around the pins.
 *
 *  Bookings dragged in from the Bookings column sit in the box as fixed
 *  blocks at their booked time. The engine never moves them; a stop that
 *  overlaps one is flagged. Only a booking for this date can go in — the
 *  box refuses any other, and so do the action and the database. */
export function DayBox(p: DayBoxProps) {
  // The order is the server's. A drag shows its own order only while the
  // reorder is in flight, then falls back to what the server sent — so a
  // later change (an accepted proposal, up/down) is never shown stale, and
  // a stale order is never written back.
  const [order, setOrder] = useOptimistic(p.items.map((i) => i.placeId));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [draggingBooking, setDraggingBooking] = useState<PlanBooking | null>(null);
  const draggedRef = useRef<PlanBooking | null>(null);
  const [dropFits, setDropFits] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const byId = new Map(p.items.map((i) => [i.placeId, i]));
  // The optimistic order, plus anything the server added since (an accepted
  // proposal, say) so a stop never silently disappears from the box.
  const items = [
    ...order.map((id) => byId.get(id)).filter((i): i is DayBoxItem => Boolean(i)),
    ...p.items.filter((i) => !order.includes(i.placeId)),
  ];
  const fillPct = Math.min(100, Math.round((p.activeMin / p.budgetMin) * 100));
  const lunchBeforeIndex = p.lunch ? items.findIndex((it) => it.startMin != null && it.startMin >= p.lunch!.endMin) : -1;

  // A booking in the plan sits in every day it covers — a stay from
  // check-in to check-out, an overnight flight on both its days — so each of
  // those days shows it and checks its stops against it.
  const blocks = p.bookings
    .filter((b) => b.plannedOn != null && canPlanOn(b, p.date))
    .map((b) => ({ b, slot: bookingSlot(b, p.date) }))
    .sort((x, y) => (x.slot.startMin ?? -1) - (y.slot.startMin ?? -1));
  const allDay = blocks.filter((x) => x.slot.startMin == null);
  const timed = blocks.filter((x) => x.slot.startMin != null);
  // Each timed booking goes before the first stop that starts at or after it.
  const blockAt = (i: number) =>
    timed.filter((x) => {
      const at = items.findIndex((it) => it.startMin != null && it.startMin >= x.slot.startMin!);
      return (at === -1 ? items.length : at) === i;
    });

  function addBooking(b: PlanBooking) {
    if (!canPlanOn(b, p.date)) {
      setMessage({ tone: "error", text: bk.wrongDay(b.title, whenText(b), shortDate(p.date)) });
      track("booking_planned", { result: "wrong_day", type: b.type });
      return;
    }
    setMessage(null);
    start(async () => {
      const r = await planBooking({ tripId: p.tripId, bookingId: b.id, date: p.date });
      setMessage(r.error ? { tone: "error", text: r.error } : { tone: "ok", text: bk.added(b.title, whenText(b)) });
      track("booking_planned", { result: r.error ? "failed" : "added", type: b.type });
    });
  }

  function removeBooking(b: PlanBooking) {
    setMessage(null);
    start(async () => {
      const r = await unplanBooking({ tripId: p.tripId, bookingId: b.id });
      setMessage(r.error ? { tone: "error", text: r.error } : { tone: "ok", text: bk.removed(b.title) });
      track("booking_planned", { result: r.error ? "failed" : "removed", type: b.type });
    });
  }

  function endBookingDrag() {
    draggedRef.current = null;
    setDraggingBooking(null);
    setDropFits(null);
  }

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const next = order.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId), 0, dragging);
    setDragging(null);
    setOver(null);
    const fd = new FormData();
    fd.set("tripId", p.tripId);
    fd.set("date", p.date);
    fd.set("order", JSON.stringify(next));
    start(async () => {
      setOrder(next);
      await reorderDay(fd);
    });
  }

  const hidden = (
    <>
      <input type="hidden" name="tripId" value={p.tripId} />
      <input type="hidden" name="date" value={p.date} />
    </>
  );

  return (
    <div data-tour="day-box" className={`box up p-3 sm:p-3.5 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_236px]">
        <div
          className={`relative flex flex-col gap-2.5 rounded-2xl ${dropFits === true ? "ring-2 ring-accent ring-offset-2 ring-offset-lacquer" : ""} ${dropFits === false ? "ring-2 ring-ume ring-offset-2 ring-offset-lacquer" : ""}`}
          onDragOver={(e) => {
            const dragged = draggingBooking ?? (e.dataTransfer.types.includes(BOOKING_DRAG) ? draggedRef.current : null);
            if (!dragged) return;
            // Accept the drop either way, so a wrong date gets a reason
            // rather than a silent no (dropEffect "none" cancels the drop,
            // and with it the message). The red ring says no while hovering.
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            const fits = canPlanOn(dragged, p.date);
            if (dropFits !== fits) setDropFits(fits);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropFits(null);
          }}
          onDrop={(e) => {
            // Read the booking from the drag itself: a quick drag can land
            // before React has re-rendered with `draggingBooking` set.
            const id = e.dataTransfer.getData(BOOKING_DRAG);
            const b = (id && p.bookings.find((x) => x.id === id)) || draggedRef.current;
            if (!b) return;
            e.preventDefault();
            endBookingDrag();
            addBooking(b);
          }}
        >
          {draggingBooking && dropFits === false && (
            <div role="alert" className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-xl bg-ume px-4 py-3 text-center text-[0.86rem] font-medium text-on-ume shadow-tile">
              {bk.wrongDayHover(draggingBooking.title, whenText(draggingBooking))}
            </div>
          )}
          {allDay.map(({ b, slot }) => <BookingBlock key={b.id} b={b} startMin={slot.startMin} endMin={slot.endMin} part={slot.part} busy={pending} onRemove={removeBooking} />)}
          {items.length === 0 && (
            <div className="tile px-5 py-8 text-center text-[0.92rem] text-ink-2">
              {p.uncovered
                ? t.uncovered(p.cityName)
                : blocks.length
                  ? t.emptyWithBookings(p.cityName)
                  : t.empty(p.cityName)}
            </div>
          )}

          {items.map((it, i) => {
            const isOver = p.overFromIndex != null && i >= p.overFromIndex;
            const showLunchBefore = i === lunchBeforeIndex;
            const height = Math.max(MIN_TILE, (it.durationMin ?? 60) * PX_PER_MIN);
            const clash = clashingBookings(it, p.bookings, p.date).map((b) => b.title);
            return (
              <div key={it.placeId} className="contents">
                {blockAt(i).map(({ b, slot }) => <BookingBlock key={b.id} b={b} startMin={slot.startMin} endMin={slot.endMin} part={slot.part} busy={pending} onRemove={removeBooking} />)}
                {i > 0 && it.arriveDetail && (
                  <div className="up flex justify-center px-2" style={{ animationDelay: `${0.06 * i}s` }}>
                    <span className="mono inline-flex items-center gap-2 text-[0.68rem] text-rice/85">
                      <span aria-hidden className="inline-block h-[1px] w-4 bg-rice/40" />
                      {it.arriveDetail}
                      {it.arriveMinutes != null && <span className="text-rice/60">· {copy.time.minutes(it.arriveMinutes)}</span>}
                    </span>
                  </div>
                )}
                {showLunchBefore && p.lunch && (
                  <div className="tile up flex gap-4 bg-tamago-soft px-4 py-3" style={{ animationDelay: `${0.06 * i}s` }}>
                    <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{clock(p.lunch.startMin)}</span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="disp text-[1.05rem] font-bold">{t.lunch}</span>
                        <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(p.lunch.endMin - p.lunch.startMin)}</span>
                      </div>
                      <p className="mt-0.5 text-[0.85rem] text-ink-2">{t.lunchNote}</p>
                    </div>
                  </div>
                )}
                {p.overFromIndex === i && (
                  <div className="flex items-center gap-3 px-2" role="separator" aria-label={t.budgetEndsLabel}>
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                    <span className="mono pop rounded-full bg-accent px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.1em] text-on-accent">{t.budgetEnds(dur(p.budgetMin))}</span>
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                  </div>
                )}
                <div
                  draggable={p.editable}
                  onDragStart={() => setDragging(it.placeId)}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (over !== it.placeId) setOver(it.placeId); }}
                  onDragLeave={() => setOver((o) => (o === it.placeId ? null : o))}
                  onDrop={(e) => onDrop(e, it.placeId)}
                  style={{ minHeight: height, animationDelay: `${0.08 * i + 0.1}s` }}
                  className={`tile up lift relative flex gap-4 px-4 py-3.5 sm:px-5 ${FILLS[i % FILLS.length]} ${isOver ? "ring-2 ring-ume/70" : ""} ${dragging === it.placeId ? "opacity-40" : ""} ${over === it.placeId && dragging && dragging !== it.placeId ? "ring-2 ring-accent" : ""} ${p.editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{it.startMin != null ? clock(it.startMin) : copy.time.noTime}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="disp text-[1.15rem] font-bold leading-tight">{it.name}</span>
                      {it.locked && (
                        <span className="mono pop inline-flex items-center gap-1.5 rounded-full bg-lacquer px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-rice" style={{ animationDelay: ".5s" }}>
                          <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
                          {t.pinned}
                        </span>
                      )}
                      {isOver && <span className="mono rounded-full bg-ume-soft px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-ume">{t.over}</span>}
                      {clash.length > 0 && <span className="mono rounded-full bg-ume-soft px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-ume">{t.clashesWith(clash.join(", "))}</span>}
                      {it.durationMin != null && <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(it.durationMin)}</span>}
                    </div>
                    {it.reason && <p className="mt-1 text-[0.86rem] leading-snug text-ink-2">{it.reason}</p>}
                    {it.reasonTerms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.reasonTerms.slice(0, 4).map((t) => (
                          <span key={t} className="mono rounded-full bg-ink/8 px-2 py-0.5 text-[0.6rem] text-ink-2">{TERM_LABEL[t] ?? t.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    )}
                    {p.editable && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <form action={togglePin}>{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <button className="min-h-9 rounded-full border border-ink/15 px-3 text-[0.78rem] text-ink-2 hover:border-ink/40" title={it.locked ? t.unpinHint : t.pinHint}>{it.locked ? t.unpin : t.pin}</button>
                        </form>
                        <form action={moveItem}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="up" />
                          <button className="min-h-9 min-w-9 rounded-full border border-ink/15 px-2 text-[0.9rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={i === 0} aria-label={t.moveEarlier(it.name)}>↑</button>
                        </form>
                        <form action={moveItem}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="down" />
                          <button className="min-h-9 min-w-9 rounded-full border border-ink/15 px-2 text-[0.9rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={i === items.length - 1} aria-label={t.moveLater(it.name)}>↓</button>
                        </form>
                        <form action={removeItem} className="ml-auto">{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <ConfirmButton message={t.removeConfirm(it.name)} aria-label={t.removeLabel(it.name)} className="min-h-9 rounded-full px-3 text-[0.78rem] text-ink-3 hover:bg-ume-soft hover:text-ume">{t.remove}</ConfirmButton>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {blockAt(items.length).map(({ b, slot }) => <BookingBlock key={b.id} b={b} startMin={slot.startMin} endMin={slot.endMin} part={slot.part} busy={pending} onRemove={removeBooking} />)}
        </div>

        <aside className="flex flex-col gap-2.5">
          <BookingsColumn
            tripId={p.tripId}
            date={p.date}
            bookings={p.bookings}
            tripDays={p.tripDays}
            busy={pending}
            message={message}
            onAdd={addBooking}
            onRemove={removeBooking}
            onDragStart={(b, e) => {
              e.dataTransfer.setData(BOOKING_DRAG, b.id);
              e.dataTransfer.effectAllowed = "copy";
              setMessage(null);
              draggedRef.current = b;
              setDraggingBooking(b);
            }}
            onDragEnd={endBookingDrag}
          />
          <div className="tile up px-4 py-4" style={{ animationDelay: ".2s" }}>
            <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{t.budget}</span>
            <div className="mt-3 flex items-center gap-4">
              <Ring pct={fillPct} over={p.overBy > 0} />
              <div>
                <span className="disp block text-[1.35rem] font-extrabold leading-none">{dur(p.activeMin)}</span>
                <span className="mono mt-1 block text-[0.7rem] text-ink-3">{t.of(dur(p.budgetMin))}</span>
                {p.overBy > 0 ? (
                  <span className="mono mt-1.5 block text-[0.7rem] text-ume">{t.overBy(dur(p.overBy))}</span>
                ) : (
                  <span className="mono mt-1.5 block text-[0.7rem] text-edamame">{t.slack(dur(p.budgetMin - p.activeMin))}</span>
                )}
              </div>
            </div>
          </div>

          <div className="tile up px-4 py-4" style={{ animationDelay: ".28s" }}>
            <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{p.cityName} · {p.tier}</span>
            <p className="mt-2 text-[0.85rem] leading-snug text-ink-2">
              {items.filter((i) => i.locked).length ? t.pinnedCount(items.filter((i) => i.locked).length) : ""}
              {p.uncovered ? t.uncoveredHowTo : t.howTo}
            </p>
            {p.editable && (
              <form action={replanDayAction} className="mt-3">
                {hidden}
                <button className="w-full rounded-full bg-lacquer px-4 py-2 text-[0.85rem] font-medium text-rice hover:bg-ink-2">{t.replan}</button>
                <p className="mono mt-2 text-[0.64rem] leading-snug text-ink-3">{t.replanNote}</p>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** A booking in the box: fixed at its booked time, never moved by the
 *  engine. Its height is its length when it has one. */
function BookingBlock({ b, startMin, endMin, part, busy, onRemove }: {
  b: PlanBooking;
  startMin: number | null;
  endMin: number | null;
  part: "starts" | "ends" | "all-day";
  busy: boolean;
  onRemove: (b: PlanBooking) => void;
}) {
  const length = startMin != null && endMin != null ? endMin - startMin : null;
  const note = part === "ends" ? (b.type === "accommodation" ? bk.checkOut : bk.ends) : part === "all-day" ? (b.type === "accommodation" ? bk.staying : bk.allDay) : b.type === "accommodation" ? bk.checkIn : null;
  // A start or end given as a date alone has no clock to show.
  const untimed = part !== "all-day" && startMin == null;
  return (
    <div
      className="tile up relative flex gap-4 border-2 border-dashed border-accent/70 bg-surface px-4 py-3 sm:px-5"
      style={{ minHeight: length ? Math.max(64, length * PX_PER_MIN) : undefined }}
    >
      <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{startMin != null ? clock(startMin) : copy.time.none}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="mono rounded-full bg-accent px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-on-accent">{bk.booked}</span>
          {untimed && <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{bk.timeNotGiven}</span>}
          <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{KIND_LABEL[b.type] ?? bk.kinds.other}{note ? ` · ${note}` : ""}</span>
          {length != null && <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(length)}</span>}
        </div>
        <p className="disp mt-1 text-[1.05rem] font-bold leading-tight">{b.title}</p>
        <div className="mt-2 flex">
          <button type="button" disabled={busy} onClick={() => onRemove(b)} className="ml-auto min-h-9 rounded-full px-3 text-[0.78rem] text-ink-3 hover:bg-ume-soft hover:text-ume disabled:opacity-50" aria-label={bk.takeOutLabel(b.title)}>
            {bk.takeOut}
          </button>
        </div>
      </div>
    </div>
  );
}

function Ring({ pct, over }: { pct: number; over: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = c * (pct / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={t.ringLabel(pct)}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-rule)" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={r} fill="none"
        stroke={over ? "var(--color-ume)" : "var(--color-accent)"}
        strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 38 38)"
        className="ring"
        style={{ ["--ring-full" as string]: `${c}` } as React.CSSProperties}
      />
      <text x="38" y="42" textAnchor="middle" className="mono" fontSize="13" fill="currentColor">{pct}%</text>
    </svg>
  );
}
