import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { travelFromGraph } from "../travel";
import { retimeDay } from "../retime";
import { kyoto } from "../__fixtures__/kyoto";

const places = new Map(kyoto.map((p) => [p.id, p]));
const travel = travelFromGraph(buildGraph(stations, edges));

describe("retimeDay", () => {
  it("runs the clock through the traveller's order with real legs and a lunch", () => {
    const d = retimeDay({
      items: [
        { placeId: "kyt-fushimi-inari", durationMin: 90, locked: false, startMin: null },
        { placeId: "kyt-tofukuji", durationMin: 60, locked: false, startMin: null },
        { placeId: "kyt-sanjusangendo", durationMin: 50, locked: false, startMin: null },
        { placeId: "kyt-kiyomizu", durationMin: 90, locked: false, startMin: null },
      ],
      places, travel, pace: "standard", dayStartMin: 7 * 60,
    });
    expect(d.items[0].startMin).toBe(420);
    expect(d.items[1].arriveBy?.lines.join(" ")).toMatch(/JR Nara Line/);
    expect(d.items[1].startMin).toBeGreaterThan(d.items[0].endMin);
    expect(d.meals).toHaveLength(1);
    expect(d.meals[0].startMin).toBeGreaterThanOrEqual(11 * 60 + 30);
    expect(d.overBy).toBe(0);
    expect(d.items.every((i) => !i.over)).toBe(true);
  });

  it("honours a pinned time, waits for opening, and flags a day that no longer fits", () => {
    const d = retimeDay({
      items: [
        { placeId: "kyt-sanjusangendo", durationMin: 50, locked: true, startMin: 10 * 60 },
        { placeId: "kyt-kiyomizu", durationMin: 120, locked: false, startMin: null },
        { placeId: "kyt-tofukuji", durationMin: 90, locked: false, startMin: null },
        { placeId: "kyt-fushimi-inari", durationMin: 180, locked: false, startMin: null },
        { placeId: "kyt-arashiyama-bamboo", durationMin: 150, locked: false, startMin: null },
      ],
      places, travel, pace: "relaxed", dayStartMin: 9 * 60,
    });
    expect(d.items[0].startMin).toBe(600);
    expect(d.overBy).toBeGreaterThan(0);
    expect(d.items[d.items.length - 1].over).toBe(true);
    expect(d.warnings.some((w) => /over a 6-hour day/.test(w))).toBe(true);
  });

  it("says when a pin cannot be reached in time", () => {
    const d = retimeDay({
      items: [
        { placeId: "kyt-kiyomizu", durationMin: 90, locked: false, startMin: null },
        { placeId: "kyt-fushimi-inari", durationMin: 60, locked: true, startMin: 7 * 60 + 30 },
      ],
      places, travel, pace: "standard", dayStartMin: 7 * 60,
    });
    expect(d.warnings.some((w) => /pinned at 07:30/.test(w))).toBe(true);
    expect(d.items[1].startMin).toBeGreaterThan(7 * 60 + 30);
  });
});
