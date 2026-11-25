import { describe, expect, it } from "vitest";
import {
  EDGE_PX,
  HOLD_MS,
  IDLE,
  MAX_EDGE_SCROLL_PX,
  MOVE_TOLERANCE_PX,
  edgeScrollSpeed,
  holdComplete,
  lift,
  moveTo,
  nativeScroll,
  owns,
  pointerMove,
  press,
  release,
  stillValid,
  targetIndex,
  type HoldState,
} from "./hold-to-drag";

const touch = { id: "b", pointerId: 7, pointerType: "touch", x: 100, y: 300, at: 1_000 };
const ORDER = ["a", "b", "c", "d"];
// Four stops, middles in page coordinates.
const MIDS = [100, 300, 500, 700];
const done = touch.at + HOLD_MS;

describe("press", () => {
  it("arms a hold for a finger", () => {
    expect(press(IDLE, touch)).toMatchObject({ phase: "pressing", id: "b", pointerId: 7 });
  });

  it("leaves a mouse to the desktop drag", () => {
    expect(press(IDLE, { ...touch, pointerType: "mouse" })).toBe(IDLE);
  });

  it("leaves a pen to the up and down buttons: it can pan without touch events, so a hold can't own its gesture", () => {
    expect(press(IDLE, { ...touch, pointerType: "pen" })).toBe(IDLE);
  });

  it("ignores a second finger while one is already held", () => {
    const held = press(IDLE, touch);
    expect(press(held, { ...touch, id: "c", pointerId: 8 })).toBe(held);
  });
});

describe("holdComplete", () => {
  it("is not complete before the hold time", () => {
    expect(holdComplete(press(IDLE, touch), done - 1)).toBe(false);
  });

  it("is complete once the finger has been held still long enough", () => {
    expect(holdComplete(press(IDLE, touch), done)).toBe(true);
  });

  it("is never complete when nothing is pressed", () => {
    expect(holdComplete(IDLE, touch.at + HOLD_MS * 10)).toBe(false);
  });

  it("holds for 400–500 ms", () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(400);
    expect(HOLD_MS).toBeLessThanOrEqual(500);
  });
});

describe("owns", () => {
  it("is true only for the pointer that holds", () => {
    const held = press(IDLE, touch);
    expect(owns(held, 7)).toBe(true);
    expect(owns(held, 8)).toBe(false);
    expect(owns(IDLE, 7)).toBe(false);
  });
});

describe("pointerMove while pressing", () => {
  const held = press(IDLE, touch);

  it("keeps the hold through a small wobble", () => {
    const s = pointerMove(held, { pointerId: 7, x: touch.x + 6, y: touch.y + 6 });
    expect(s.phase).toBe("pressing");
  });

  it("cancels the hold when the finger moves past the tolerance, so a swipe scrolls", () => {
    expect(pointerMove(held, { pointerId: 7, x: touch.x, y: touch.y + MOVE_TOLERANCE_PX + 1 })).toBe(IDLE);
    expect(pointerMove(held, { pointerId: 7, x: touch.x - MOVE_TOLERANCE_PX - 1, y: touch.y })).toBe(IDLE);
  });

  it("ignores another pointer", () => {
    expect(pointerMove(held, { pointerId: 9, x: 0, y: 0 })).toBe(held);
  });
});

describe("nativeScroll", () => {
  it("cancels a hold the page has started scrolling under", () => {
    expect(nativeScroll(press(IDLE, touch))).toBe(IDLE);
  });

  it("leaves a lifted stop alone: its own edge scroll moves the page", () => {
    const s = lift(press(IDLE, touch), { order: ORDER, mids: MIDS, pageY: 300, now: done });
    expect(nativeScroll(s)).toBe(s);
  });
});

describe("lift, drag and release", () => {
  const lifted = () => lift(press(IDLE, touch), { order: ORDER, mids: MIDS, pageY: 300, now: done });

  it("doesn't lift a press that hasn't been held long enough", () => {
    const pressing = press(IDLE, touch);
    expect(lift(pressing, { order: ORDER, mids: MIDS, pageY: 300, now: done - 1 })).toBe(pressing);
  });

  it("doesn't lift when nothing is pressed", () => {
    expect(lift(IDLE, { order: ORDER, mids: MIDS, pageY: 300, now: done })).toBe(IDLE);
  });

  it("cancels when the held stop is no longer in the day", () => {
    expect(lift(press(IDLE, touch), { order: ["a", "c"], mids: [100, 300], pageY: 300, now: done })).toBe(IDLE);
  });

  it("lifts a completed press, finding the stop by id in the order at that moment", () => {
    expect(lifted()).toMatchObject({ phase: "dragging", id: "b", from: 1, to: 1, dy: 0, order: ORDER });
  });

  it("follows the finger and works out where it would land", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 560 });
    expect(s).toMatchObject({ phase: "dragging", dy: 260, to: 2 });
  });

  it("ignores another pointer moving while a stop is lifted", () => {
    const s = lifted();
    expect(pointerMove(s, { pointerId: 8, x: 0, y: 0, pageY: 9_999 })).toBe(s);
  });

  it("drops it where it lands, as the new order", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 760 });
    expect(release(s, 7, ORDER)).toEqual({ state: IDLE, next: ["a", "c", "d", "b"] });
  });

  it("saves nothing when the day changed under the finger (an up/down tap, a refresh)", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 760 });
    // B was moved up meanwhile: dropping by position would move A.
    expect(release(s, 7, ["b", "a", "c", "d"])).toEqual({ state: IDLE, next: null });
  });

  it("saves nothing when it lands where it started", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 320 });
    expect(release(s, 7, ORDER)).toEqual({ state: IDLE, next: null });
  });

  it("saves nothing when a press is let go before it lifts (a tap)", () => {
    expect(release(press(IDLE, touch), 7, ORDER)).toEqual({ state: IDLE, next: null });
  });

  it("ignores another pointer letting go", () => {
    const s = lifted();
    expect(release(s, 99, ORDER)).toEqual({ state: s, next: null });
  });
});

describe("stillValid", () => {
  const lifted = lift(press(IDLE, touch), { order: ORDER, mids: MIDS, pageY: 300, now: done }) as HoldState;

  it("holds while nothing is held", () => {
    expect(stillValid(IDLE, [])).toBe(true);
  });

  it("drops a press whose stop has gone", () => {
    expect(stillValid(press(IDLE, touch), ORDER)).toBe(true);
    expect(stillValid(press(IDLE, touch), ["a", "c"])).toBe(false);
  });

  it("drops a lifted stop once the day's order is not the one it lifted from", () => {
    expect(stillValid(lifted, [...ORDER])).toBe(true);
    expect(stillValid(lifted, ["b", "a", "c", "d"])).toBe(false);
    expect(stillValid(lifted, ["a", "b", "c", "d", "e"])).toBe(false);
  });
});

describe("targetIndex", () => {
  it("counts the other stops whose middle is above the finger", () => {
    expect(targetIndex(MIDS, 0, 50)).toBe(0);
    expect(targetIndex(MIDS, 0, 350)).toBe(1);
    expect(targetIndex(MIDS, 0, 9_999)).toBe(3);
    expect(targetIndex(MIDS, 3, 0)).toBe(0);
    expect(targetIndex(MIDS, 3, 450)).toBe(2);
  });

  it("stays put while the finger is between its neighbours' middles", () => {
    expect(targetIndex(MIDS, 2, 310)).toBe(2);
    expect(targetIndex(MIDS, 2, 690)).toBe(2);
  });
});

describe("moveTo", () => {
  it("moves one id and keeps the rest in order", () => {
    expect(moveTo(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
    expect(moveTo(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the same order for a move to itself or out of range", () => {
    const order = ["a", "b"];
    expect(moveTo(order, 1, 1)).toEqual(order);
    expect(moveTo(order, 5, 0)).toEqual(order);
  });

  it("moves a pinned stop like any other: the ↑ ↓ buttons and reorderDay allow it", () => {
    expect(moveTo(["pinned", "b"], 0, 1)).toEqual(["b", "pinned"]);
  });
});

describe("edgeScrollSpeed", () => {
  it("doesn't scroll away from the edges", () => {
    expect(edgeScrollSpeed(400, 800)).toBe(0);
    expect(edgeScrollSpeed(EDGE_PX, 800)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom, faster closer in", () => {
    expect(edgeScrollSpeed(EDGE_PX / 2, 800)).toBeLessThan(0);
    expect(edgeScrollSpeed(800 - EDGE_PX / 2, 800)).toBeGreaterThan(0);
    expect(edgeScrollSpeed(2, 800)).toBeLessThan(edgeScrollSpeed(EDGE_PX / 2, 800));
  });

  it("never goes past the top speed, even off screen", () => {
    expect(edgeScrollSpeed(-200, 800)).toBe(-MAX_EDGE_SCROLL_PX);
    expect(edgeScrollSpeed(2_000, 800)).toBe(MAX_EDGE_SCROLL_PX);
  });
});
