"use client";

import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition, type DragEvent, type PointerEvent } from "react";
import { moveItem, removeItem, reorderDay, replanDayAction, togglePin } from "./day-actions";
import { planBooking, unplanBooking } from "./booking-actions";
import { BOOKING_DRAG, BookingsColumn, KIND_LABEL, shortDate, whenText, type PlanBooking } from "./bookings-column";
import { ConfirmButton } from "@/components/form-controls";
import { bookingSlot, canPlanOn, clashingBookings } from "@/lib/vault/plan-day";
import { copy } from "@/copy";
import { track } from "@/lib/analytics/client";
import { placeMapUrl } from "@/lib/maps/links";
import { showsMainSights } from "@/lib/trips/route-card";
import { arriveMinutesSuffix } from "@/lib/trips/arrive-line";
import { HOLD_MS, IDLE, edgeScrollSpeed, layoutMoved, lift, nativeScroll, owns, pointerMove, press, release, stillValid, type HoldState } from "./hold-to-drag";

const t = copy.day;
/** The clock a hold is timed by (event handlers only). */
const now = () => performance.now();
/** An element's top on the page, by layout offsets (transforms ignored). */
function pageTop(el: HTMLElement): number {
  let y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
  return y;
}
const bk = copy.bookings;

export interface DayBoxItem {
  placeId: string;
  name: string;
  /** Null when the place is no longer present in places_public. */
  mapName?: string | null;
  nameJa?: string | null;
  startMin: number | null;
  durationMin: number | null;
  locked: boolean;
  reason: string | null;
  reasonTerms: string[];
  arriveMode: string | null;
  arriveMinutes: number | null;
  arriveDetail: string | null;
  /** The place's checked background (0027), when it has one. */
  background?: string | null;
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
  /** How full the day is, 0–100 (`fillPercent`, worked out on the server). */
  fillPct: number;
  activeMin: number;
  overBy: number;
  overFromIndex: number | null;
  lunch: { startMin: number; endMin: number } | null;
  /** Gaps of over two hours the day waits through (`dayStats`), said in
   *  the box: a day saved at once never shows the planner's note. */
  freeTime?: { startMin: number; endMin: number; beforeIndex: number }[];
  editable: boolean;
  /** A city Bento can't plan days in yet: the box says so, rather than
   *  inviting the traveller to ask for stops that can't come. */
  uncovered?: boolean;
  /** A city Bento knows by its main sights only: a planned day says what
   *  it rests on (`copy.mainSightsDay`). */
  mainSights?: boolean;
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
 *  Drag reorders (a mouse drags at once; a finger or pen holds a stop
 *  first, `hold-to-drag.ts`); pin and remove apply at once and the engine
 *  re-times the day. Re-plan asks the engine to choose again around the pins.
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
  // Hold-to-drag on a touch screen. The rules are in hold-to-drag.ts; the
  // ref is the truth for event handlers, `held` is what the render shows.
  // The stops' container captures the finger, so a card re-rendered or
  // removed under it can't strand the drag.
  const stopsRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HoldState>(IDLE);
  const holdTimer = useRef<number | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const lastClientY = useRef(0);
  const [held, setHeld] = useState<{ id: string; dy: number; to: number } | null>(null);
  // The desktop drag only where there is a mouse: on a phone a long press
  // could start the browser's own drag and fight the hold.
  const [mouseDrag, setMouseDrag] = useState(true);
  const byId = new Map(p.items.map((i) => [i.placeId, i]));
  // The optimistic order, plus anything the server added since (an accepted
  // proposal, say) so a stop never silently disappears from the box.
  const items = [
    ...order.map((id) => byId.get(id)).filter((i): i is DayBoxItem => Boolean(i)),
    ...p.items.filter((i) => !order.includes(i.placeId)),
  ];
  const fillPct = p.fillPct;
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
    saveOrder(next);
  }

  function saveOrder(next: string[]) {
    const fd = new FormData();
    fd.set("tripId", p.tripId);
    fd.set("date", p.date);
    fd.set("order", JSON.stringify(next));
    start(async () => {
      setOrder(next);
      await reorderDay(fd);
    });
  }

  // Pin, up, down and remove run in the same transition as a reorder, so
  // `pending` is true from the moment one starts until it settles, whether
  // it worked or failed. Holds and saves wait on it, and one edit never
  // races another over the same day.
  function stopEdit(action: (fd: FormData) => Promise<void>) {
    return (fd: FormData) => {
      cancelHold();
      start(async () => {
        await action(fd);
      });
    };
  }

  // Where there is a mouse; and while a stop is held, the page stays still
  // under it, and a press the page scrolls under is a swipe.
  useEffect(() => {
    const media = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const update = () => setMouseDrag(media.matches);
    update();
    media.addEventListener("change", update);
    // React's touch listeners are passive. While a stop is lifted this one
    // stops the page scrolling under the finger; a plain swipe still scrolls.
    const box = stopsRef.current;
    const holdScroll = (e: TouchEvent) => {
      if (holdRef.current.phase === "dragging" && e.cancelable) e.preventDefault();
    };
    // Scrolling began before the hold was done: the browser has the
    // gesture, so the hold gives way rather than lift and be cut off.
    const pageScrolled = () => {
      if (nativeScroll(holdRef.current) !== holdRef.current) clearHold();
    };
    box?.addEventListener("touchmove", holdScroll, { passive: false });
    window.addEventListener("scroll", pageScrolled, { passive: true });
    return () => {
      media.removeEventListener("change", update);
      box?.removeEventListener("touchmove", holdScroll);
      window.removeEventListener("scroll", pageScrolled);
      clearHold();
    };
  }, []);

  // The day changed while a stop was held (an up/down, a refresh): its
  // order and the measured cards are stale, so the drag is dropped unsaved.
  const ids = items.map((i) => i.placeId);
  const idsKey = ids.join("\n");
  const dropStaleHold = useEffectEvent((current: string[]) => {
    if (!stillValid(holdRef.current, current)) cancelHold();
  });
  useEffect(() => {
    dropStaleHold(idsKey ? idsKey.split("\n") : []);
  }, [idsKey]);

  function setHold(s: HoldState) {
    holdRef.current = s;
    setHeld(s.phase === "dragging" ? { id: s.id, dy: s.dy, to: s.to } : null);
  }

  /** Stops the timer, the edge scroll and the capture. Saves nothing. */
  function clearHold() {
    const s = holdRef.current;
    if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current);
    holdTimer.current = null;
    scrollFrame.current = null;
    holdRef.current = IDLE;
    const box = stopsRef.current;
    if (s.phase !== "idle" && box?.hasPointerCapture(s.pointerId)) {
      try {
        box.releasePointerCapture(s.pointerId);
      } catch {
        // Already released by the browser.
      }
    }
  }

  /** The one way a hold ends without a drop. */
  function cancelHold() {
    clearHold();
    setHeld(null);
  }

  function onHoldDown(e: PointerEvent<HTMLDivElement>) {
    if (!p.editable || pending) return;
    const target = e.target as Element;
    // Buttons, links and "About this place" keep their own taps.
    if (target.closest("a, button, summary, input, select, textarea")) return;
    const id = target.closest<HTMLElement>("[data-stop]")?.dataset.stop;
    if (!id) return;
    const next = press(holdRef.current, { id, pointerId: e.pointerId, pointerType: e.pointerType, x: e.clientX, y: e.clientY, at: now() });
    if (next === holdRef.current) return;
    holdRef.current = next;
    lastClientY.current = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone.
    }
    holdTimer.current = window.setTimeout(liftHeld, HOLD_MS);
  }

  /** The stops in the box, top to bottom, and each one's middle in page
   *  coordinates, from the layout alone: offsets ignore transforms, so the
   *  held stop's `translate` and grow, and a tile's hover lift, never read
   *  as the layout moving. */
  function measure() {
    const cards = [...(stopsRef.current?.querySelectorAll<HTMLElement>("[data-stop]") ?? [])];
    return {
      order: cards.map((c) => c.dataset.stop ?? ""),
      mids: cards.map((c) => pageTop(c) + c.offsetHeight / 2),
    };
  }

  function liftHeld() {
    holdTimer.current = null;
    const s = holdRef.current;
    if (s.phase !== "pressing") return;
    const lifted = lift(s, { ...measure(), pageY: lastClientY.current + window.scrollY, now: now() });
    if (lifted === s) {
      holdTimer.current = window.setTimeout(liftHeld, 16);
      return;
    }
    if (lifted.phase !== "dragging") return cancelHold();
    setHold(lifted);
    try {
      navigator.vibrate?.(10);
    } catch {
      // No vibration here; the lift still shows.
    }
    scrollFrame.current = requestAnimationFrame(dragFrame);
  }

  // Every frame of a drag: if anything in the box (a booking block, a
  // free-time tile, a leg) or above it has moved the stops since the lift,
  // the sums are stale and the drag is dropped unsaved. Near the top or
  // bottom of the screen, the held stop scrolls the page.
  function dragFrame() {
    const s = holdRef.current;
    if (s.phase !== "dragging") return;
    if (layoutMoved(s.mids, measure().mids)) return cancelHold();
    const v = edgeScrollSpeed(lastClientY.current, window.innerHeight);
    if (v) {
      window.scrollBy(0, v);
      setHold(pointerMove(s, { pointerId: s.pointerId, x: 0, y: lastClientY.current, pageY: lastClientY.current + window.scrollY }));
    }
    scrollFrame.current = requestAnimationFrame(dragFrame);
  }

  function onHoldMove(e: PointerEvent) {
    const s = holdRef.current;
    // Only the holding finger counts; a second finger or a mouse is ignored.
    if (!owns(s, e.pointerId)) return;
    lastClientY.current = e.clientY;
    const next = pointerMove(s, { pointerId: e.pointerId, x: e.clientX, y: e.clientY, pageY: e.clientY + window.scrollY });
    if (next === s) return;
    if (next.phase === "idle") return cancelHold();
    setHold(next);
  }

  function onHoldUp(e: PointerEvent) {
    const s = holdRef.current;
    if (!owns(s, e.pointerId)) return;
    const { next } = release(s, e.pointerId, ids);
    cancelHold();
    if (next && !pending) saveOrder(next);
  }

  function onHoldLost(e: PointerEvent) {
    if (owns(holdRef.current, e.pointerId)) cancelHold();
  }

  // While a stop is lifted or a reorder is saving, the other edits wait, so
  // two changes never race over the same day.
  const editsLocked = held != null || pending;

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
          ref={stopsRef}
          onPointerDown={onHoldDown}
          onPointerMove={onHoldMove}
          onPointerUp={onHoldUp}
          onPointerCancel={onHoldLost}
          onLostPointerCapture={onHoldLost}
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
            const suffix = arriveMinutesSuffix(it.arriveMode, it.arriveMinutes);
            // Free time ends when the leg to this stop starts, so it is drawn
            // before the leg, or after lunch when lunch is in the same gap.
            const freeTile = (p.freeTime ?? []).filter((f) => f.beforeIndex === i && it.startMin != null).map((f) => (
              <div key={`free-${f.startMin}`} className="tile up flex gap-4 bg-sunk px-4 py-3" style={{ animationDelay: `${0.06 * i}s` }}>
                <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{clock(f.startMin)}</span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="disp text-[1.05rem] font-bold">{t.freeTime}</span>
                    <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(f.endMin - f.startMin)}</span>
                  </div>
                  <p className="mt-0.5 text-[0.85rem] text-ink-2">{t.freeTimeNote(it.name, clock(it.startMin!))}</p>
                </div>
              </div>
            ));
            return (
              <div key={it.placeId} className="contents">
                {blockAt(i).map(({ b, slot }) => <BookingBlock key={b.id} b={b} startMin={slot.startMin} endMin={slot.endMin} part={slot.part} busy={pending} onRemove={removeBooking} />)}
                {!showLunchBefore && freeTile}
                {i > 0 && it.arriveDetail && (
                  <div className="up flex justify-center px-2" style={{ animationDelay: `${0.06 * i}s` }}>
                    <span className="mono inline-flex items-center gap-2 text-[0.68rem] text-rice/85">
                      <span aria-hidden className="inline-block h-[1px] w-4 bg-rice/40" />
                      {it.arriveDetail}
                      {suffix != null && <span className="text-rice/60">· {copy.time.minutes(suffix)}</span>}
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
                {showLunchBefore && freeTile}
                {p.overFromIndex === i && (
                  <div className="flex items-center gap-3 px-2" role="separator" aria-label={t.budgetEndsLabel}>
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                    <span className="mono pop rounded-full bg-accent px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.1em] text-on-accent">{t.budgetEnds(dur(p.budgetMin))}</span>
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                  </div>
                )}
                <div
                  data-stop={it.placeId}
                  draggable={p.editable && mouseDrag}
                  onDragStart={(e) => {
                    // A finger holding the stop owns this drag.
                    if (holdRef.current.phase !== "idle") return e.preventDefault();
                    setDragging(it.placeId);
                  }}
                  // A long press would open the browser's menu over the stop.
                  onContextMenu={(e) => {
                    if (holdRef.current.phase !== "idle") e.preventDefault();
                  }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (over !== it.placeId) setOver(it.placeId); }}
                  onDragLeave={() => setOver((o) => (o === it.placeId ? null : o))}
                  onDrop={(e) => onDrop(e, it.placeId)}
                  // A held stop follows the finger with `translate`, which the
                  // tile's rise animation (on `transform`) doesn't override.
                  // Inline, because `.tile` outranks utilities: the held stop
                  // is solid (a see-through tile shows the one under it) and
                  // the stop it would land on is outlined.
                  style={{
                    minHeight: height,
                    animationDelay: `${0.08 * i + 0.1}s`,
                    ...(held?.id === it.placeId
                      ? { translate: `0 ${held.dy}px`, touchAction: "none", background: "var(--color-surface)", outline: "2px solid var(--color-accent)" }
                      : {}),
                    ...(held && held.id !== it.placeId && held.to === i ? { outline: "2px dashed var(--color-accent)", outlineOffset: "2px" } : {}),
                  }}
                  className={`tile up lift relative flex gap-4 px-4 py-3.5 sm:px-5 ${FILLS[i % FILLS.length]} ${isOver ? "ring-2 ring-ume/70" : ""} ${dragging === it.placeId ? "opacity-40" : ""} ${over === it.placeId && dragging && dragging !== it.placeId ? "ring-2 ring-accent" : ""} ${held?.id === it.placeId ? "z-20 motion-safe:scale-[1.02]" : ""} ${p.editable ? "cursor-grab active:cursor-grabbing [@media(any-pointer:coarse)]:select-none [-webkit-touch-callout:none]" : ""}`}
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
                    {it.mapName && (
                      <a
                        href={placeMapUrl({ name: it.mapName, nameJa: it.nameJa, cityName: p.cityName })}
                        target="_blank"
                        rel="noopener noreferrer"
                        // A link is its own drag source, so a drag that starts
                        // here is cancelled instead of moving the stop.
                        onDragStart={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        aria-label={t.openMap(it.mapName)}
                        className="mt-0.5 inline-flex min-h-6 items-center text-[0.82rem] font-medium text-accent-ink hover:underline"
                      >
                        {t.map}
                      </a>
                    )}
                    {it.reason && <p className="mt-1 text-[0.86rem] leading-snug text-ink-2">{it.reason}</p>}
                    {it.background && (
                      <details className="mt-1.5 text-[0.84rem] text-ink-2">
                        <summary
                          // Like the map link: a drag that starts here is
                          // cancelled instead of moving the stop.
                          draggable
                          onDragStart={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          className="inline-flex min-h-6 cursor-pointer items-center font-medium text-accent-ink hover:underline"
                        >
                          {t.about}
                        </summary>
                        <p className="mt-1 leading-snug">{it.background}</p>
                      </details>
                    )}
                    {it.reasonTerms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.reasonTerms.slice(0, 4).map((t) => (
                          <span key={t} className="mono rounded-full bg-ink/8 px-2 py-0.5 text-[0.6rem] text-ink-2">{TERM_LABEL[t] ?? t.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    )}
                    {p.editable && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <form action={stopEdit(togglePin)}>{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <button className="min-h-9 rounded-full border border-ink/15 px-3 text-[0.78rem] text-ink-2 hover:border-ink/40 disabled:opacity-50" title={it.locked ? t.unpinHint : t.pinHint} disabled={editsLocked}>{it.locked ? t.unpin : t.pin}</button>
                        </form>
                        <form action={stopEdit(moveItem)}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="up" />
                          <button className="min-h-9 min-w-9 rounded-full border border-ink/15 px-2 text-[0.9rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={editsLocked || i === 0} aria-label={t.moveEarlier(it.name)}>↑</button>
                        </form>
                        <form action={stopEdit(moveItem)}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="down" />
                          <button className="min-h-9 min-w-9 rounded-full border border-ink/15 px-2 text-[0.9rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={editsLocked || i === items.length - 1} aria-label={t.moveLater(it.name)}>↓</button>
                        </form>
                        <form action={stopEdit(removeItem)} className="ml-auto">{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <ConfirmButton disabled={editsLocked} message={t.removeConfirm(it.name)} aria-label={t.removeLabel(it.name)} className="min-h-9 rounded-full px-3 text-[0.78rem] text-ink-3 hover:bg-ume-soft hover:text-ume">{t.remove}</ConfirmButton>
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
            {showsMainSights(p.mainSights ? "outline" : null, items.length) && <p className="mt-2 text-[0.85rem] leading-snug text-ink-2">{copy.mainSightsDay}</p>}
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
