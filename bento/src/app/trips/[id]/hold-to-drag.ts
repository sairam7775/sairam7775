/** Hold a stop, then drag it: the day box's reorder on a touch screen.
 *  Pure, so the rules are tested without a browser; `day-box.tsx` feeds it
 *  pointer events, a timer and the cards' measured middles.
 *
 *  A finger or pen must be held still for `HOLD_MS` before the stop lifts.
 *  Moving more than `MOVE_TOLERANCE_PX` first cancels the hold, so a swipe
 *  is a scroll. A mouse never arms a hold: the desktop keeps its own drag.
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
  if (s.phase !== "idle") return s;
  if (p.pointerType !== "touch" && p.pointerType !== "pen") return s;
  return { phase: "pressing", id: p.id, pointerId: p.pointerId, x: p.x, y: p.y, at: p.at };
}

export function holdComplete(s: HoldState, now: number): boolean {
  return s.phase === "pressing" && now - s.at >= HOLD_MS;
}

/** The hold is done: the stop at `from` lifts under the finger. */
export function lift(s: HoldState, m: { from: number; mids: number[]; pageY: number }): HoldState {
  if (s.phase !== "pressing") return s;
  return { phase: "dragging", id: s.id, pointerId: s.pointerId, from: m.from, to: m.from, mids: m.mids, startPageY: m.pageY, dy: 0 };
}

/** `x`/`y` are screen coordinates (for the hold's tolerance); `pageY`
 *  includes the page's scroll (for where a dragged stop lands). */
export function pointerMove(s: HoldState, p: { pointerId: number; x: number; y: number; pageY?: number }): HoldState {
  if (s.phase === "idle" || p.pointerId !== s.pointerId) return s;
  if (s.phase === "pressing") {
    return Math.hypot(p.x - s.x, p.y - s.y) > MOVE_TOLERANCE_PX ? IDLE : s;
  }
  if (p.pageY == null) return s;
  return { ...s, dy: p.pageY - s.startPageY, to: targetIndex(s.mids, s.from, p.pageY) };
}

export function release(s: HoldState, pointerId: number): { state: HoldState; move: { id: string; from: number; to: number } | null } {
  if (s.phase === "idle" || pointerId !== s.pointerId) return { state: s, move: null };
  if (s.phase === "pressing" || s.to === s.from) return { state: IDLE, move: null };
  return { state: IDLE, move: { id: s.id, from: s.from, to: s.to } };
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
