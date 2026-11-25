/** Hold a stop, then drag it: the day box's reorder on a touch screen.
 *  Pure, so the rules are tested without a browser; `day-box.tsx` feeds it
 *  pointer events, a timer, scrolls and the cards' measured middles.
 *
 *  A finger must be held still for `HOLD_MS` before the stop lifts. Moving
 *  more than `MOVE_TOLERANCE_PX` first, or the page starting to scroll,
 *  cancels the hold, so a swipe is a scroll. A mouse never arms a hold: the
 *  desktop keeps its own drag. Nor does a pen: it can pan the page without
 *  sending touch events, so nothing can stop the page scrolling under a
 *  lifted stop; a pen uses the ↑ ↓ buttons.
 *
 *  A lifted stop keeps the day's order as it was when it lifted. If the day
 *  changes before the drop (an ↑ ↓ tap, a refresh), the drag is cancelled
 *  and nothing is saved: dropping by position would move the wrong stop.
 *
 *  Pinned stops lift like any other, because the ↑ ↓ buttons and
 *  `reorderDay` move them too; re-timing never starts a pin before its
 *  pinned time. */

export const HOLD_MS = 450;
export const MOVE_TOLERANCE_PX = 10;
/** How close to the top or bottom of the screen a dragged stop scrolls it. */
export const EDGE_PX = 64;
/** The fastest scroll, in pixels a frame, with the finger at the very edge. */
export const MAX_EDGE_SCROLL_PX = 14;

export type HoldState =
  | { phase: "idle" }
  | { phase: "pressing"; id: string; pointerId: number; x: number; y: number; at: number }
  | {
      phase: "dragging";
      id: string;
      pointerId: number;
      /** The day's stop ids as they were when it lifted. */
      order: string[];
      from: number;
      to: number;
      /** Each stop's middle, in page coordinates, measured as it lifted. */
      mids: number[];
      /** Where the finger was on the page when it lifted, and how far it has come since. */
      startPageY: number;
      dy: number;
    };

export const IDLE: HoldState = { phase: "idle" };

export function press(
  s: HoldState,
  p: { id: string; pointerId: number; pointerType: string; x: number; y: number; at: number },
): HoldState {
  if (s.phase !== "idle" || p.pointerType !== "touch") return s;
  return { phase: "pressing", id: p.id, pointerId: p.pointerId, x: p.x, y: p.y, at: p.at };
}

/** Whether this pointer is the one holding. Check it before using any of
 *  the event's values, so a second finger or a mouse can't steer the drag. */
export function owns(s: HoldState, pointerId: number): boolean {
  return s.phase !== "idle" && s.pointerId === pointerId;
}

export function holdComplete(s: HoldState, now: number): boolean {
  return s.phase === "pressing" && now - s.at >= HOLD_MS;
}

/** The hold is done: the stop lifts under the finger. `order` and `mids`
 *  are the day's cards as they are now, in the same order. */
export function lift(s: HoldState, m: { order: string[]; mids: number[]; pageY: number; now: number }): HoldState {
  if (s.phase !== "pressing" || !holdComplete(s, m.now)) return s;
  const from = m.order.indexOf(s.id);
  if (from < 0 || m.mids.length !== m.order.length) return IDLE;
  return {
    phase: "dragging",
    id: s.id,
    pointerId: s.pointerId,
    order: [...m.order],
    from,
    to: from,
    mids: m.mids,
    startPageY: m.pageY,
    dy: 0,
  };
}

/** `x`/`y` are screen coordinates (for the hold's tolerance); `pageY`
 *  includes the page's scroll (for where a dragged stop lands). */
export function pointerMove(s: HoldState, p: { pointerId: number; x: number; y: number; pageY?: number }): HoldState {
  if (!owns(s, p.pointerId)) return s;
  if (s.phase === "pressing") {
    return Math.hypot(p.x - s.x, p.y - s.y) > MOVE_TOLERANCE_PX ? IDLE : s;
  }
  if (s.phase !== "dragging" || p.pageY == null) return s;
  return { ...s, dy: p.pageY - s.startPageY, to: targetIndex(s.mids, s.from, p.pageY) };
}

/** The page scrolled by itself: a press it scrolled under is a swipe. A
 *  lifted stop's own edge scroll is expected. */
export function nativeScroll(s: HoldState): HoldState {
  return s.phase === "pressing" ? IDLE : s;
}

/** Whether a hold still makes sense against the day as it is now. */
export function stillValid(s: HoldState, order: string[]): boolean {
  if (s.phase === "idle") return true;
  if (s.phase === "pressing") return order.includes(s.id);
  return sameOrder(s.order, order);
}

/** Let go. `next` is the order to save, or null when there is nothing to
 *  save: a tap, a drop where it started, or a day that changed meanwhile. */
export function release(s: HoldState, pointerId: number, order: string[]): { state: HoldState; next: string[] | null } {
  if (!owns(s, pointerId)) return { state: s, next: null };
  if (s.phase !== "dragging" || s.to === s.from || !stillValid(s, order)) return { state: IDLE, next: null };
  return { state: IDLE, next: moveTo(s.order, s.order.indexOf(s.id), s.to) };
}

/** Where the dragged stop would land: after every other stop whose middle
 *  the finger has passed. */
export function targetIndex(mids: number[], from: number, pageY: number): number {
  let to = 0;
  mids.forEach((m, i) => {
    if (i !== from && m < pageY) to += 1;
  });
  return to;
}

export function moveTo<T>(order: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= order.length) return order;
  const next = order.filter((_, i) => i !== from);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, order[from]);
  return next;
}

/** Pixels to scroll this frame: negative near the top, positive near the
 *  bottom, faster the closer the finger is to the edge. */
export function edgeScrollSpeed(clientY: number, viewportHeight: number): number {
  const ramp = (depth: number) => Math.round(MAX_EDGE_SCROLL_PX * Math.min(1, depth / EDGE_PX));
  if (clientY < EDGE_PX) return -ramp(EDGE_PX - clientY);
  if (clientY > viewportHeight - EDGE_PX) return ramp(clientY - (viewportHeight - EDGE_PX));
  return 0;
}

/** How far a stop may sit from where it was measured before the drag's
 *  sums are stale (rounding, sub-pixel layout). */
export const LAYOUT_SLACK_PX = 1;

/** Whether the stops moved since they were measured at the lift: anything
 *  re-rendered in the box (a booking block, a free-time tile, a leg) or
 *  above it. Then the drag is cancelled rather than dropped by old sums. */
export function layoutMoved(saved: number[], now: number[]): boolean {
  return saved.length !== now.length || saved.some((m, i) => Math.abs(m - now[i]) > LAYOUT_SLACK_PX);
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
