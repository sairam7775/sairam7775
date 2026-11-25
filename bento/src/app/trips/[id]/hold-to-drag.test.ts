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
  pointerMove,
  press,
  release,
  targetIndex,
} from "./hold-to-drag";

const touch = { id: "b", pointerId: 7, pointerType: "touch", x: 100, y: 300, at: 1_000 };

describe("press", () => {
  it("arms a hold for a finger or a pen", () => {
    expect(press(IDLE, touch)).toMatchObject({ phase: "pressing", id: "b", pointerId: 7 });
    expect(press(IDLE, { ...touch, pointerType: "pen" }).phase).toBe("pressing");
  });

  it("leaves a mouse to the desktop drag", () => {
    expect(press(IDLE, { ...touch, pointerType: "mouse" })).toBe(IDLE);
  });

  it("ignores a second finger while one is already held", () => {
    const held = press(IDLE, touch);
    expect(press(held, { ...touch, id: "c", pointerId: 8 })).toBe(held);
  });
});

describe("holdComplete", () => {
  it("is not complete before the hold time", () => {
    expect(holdComplete(press(IDLE, touch), touch.at + HOLD_MS - 1)).toBe(false);
  });

  it("is complete once the finger has been held still long enough", () => {
    expect(holdComplete(press(IDLE, touch), touch.at + HOLD_MS)).toBe(true);
  });

  it("is never complete when nothing is pressed", () => {
    expect(holdComplete(IDLE, touch.at + HOLD_MS * 10)).toBe(false);
  });

  it("holds for 400–500 ms", () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(400);
    expect(HOLD_MS).toBeLessThanOrEqual(500);
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

describe("lift, drag and release", () => {
  // Four stops, midpoints in page coordinates.
  const mids = [100, 300, 500, 700];
  const lifted = () => lift(press(IDLE, touch), { from: 1, mids, pageY: 300 });

  it("lifts only a completed press", () => {
    expect(lift(IDLE, { from: 1, mids, pageY: 300 })).toBe(IDLE);
    expect(lifted()).toMatchObject({ phase: "dragging", id: "b", from: 1, to: 1, dy: 0 });
  });

  it("follows the finger and works out where it would land", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 560 });
    expect(s).toMatchObject({ phase: "dragging", dy: 260, to: 2 });
  });

  it("drops it where it lands and reports the move", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 760 });
    expect(release(s, 7)).toEqual({ state: IDLE, move: { id: "b", from: 1, to: 3 } });
  });

  it("reports no move when it lands where it started", () => {
    const s = pointerMove(lifted(), { pointerId: 7, x: 100, y: 0, pageY: 320 });
    expect(release(s, 7)).toEqual({ state: IDLE, move: null });
  });

  it("reports no move when a press is let go before it lifts (a tap)", () => {
    expect(release(press(IDLE, touch), 7)).toEqual({ state: IDLE, move: null });
  });

  it("ignores another pointer letting go", () => {
    const s = lifted();
    expect(release(s, 99)).toEqual({ state: s, move: null });
  });
});

describe("targetIndex", () => {
  const mids = [100, 300, 500, 700];

  it("counts the other stops whose middle is above the finger", () => {
    expect(targetIndex(mids, 0, 50)).toBe(0);
    expect(targetIndex(mids, 0, 350)).toBe(1);
    expect(targetIndex(mids, 0, 9_999)).toBe(3);
    expect(targetIndex(mids, 3, 0)).toBe(0);
    expect(targetIndex(mids, 3, 450)).toBe(2);
  });

  it("stays put while the finger is between its neighbours' middles", () => {
    expect(targetIndex(mids, 2, 310)).toBe(2);
    expect(targetIndex(mids, 2, 690)).toBe(2);
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
