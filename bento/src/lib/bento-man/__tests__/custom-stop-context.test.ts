/** Bento Man's trip state with a free-text stop (0036). The traveller's
 *  words are in its name and its key, so both pass through clean(); a
 *  Bento stop's line is unchanged. */
import { describe, expect, it } from "vitest";
import { buildContext } from "../context";
import { clean } from "../guard";
import { DEFAULT_PREFS, type TripState } from "../store";
import { customStopKey } from "../custom-stop";

function state(items: { placeId: string; name: string }[]): TripState {
  return {
    trip: { id: "t", title: null, startDate: "2026-11-20", endDate: "2026-11-22", partySize: 1, status: "planning" },
    prefs: DEFAULT_PREFS,
    cities: [],
    days: [{ date: "2026-11-21", cityId: "kyoto-city", items: items.map((it, i) => ({ ...it, sortOrder: i, startMin: 600, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null })) }],
    pendingProposal: null,
  };
}

describe("trip state with a free-text stop", () => {
  it("a Bento stop's line is exactly as before", () => {
    expect(buildContext(state([{ placeId: "kyt-gion", name: "Gion" }]), [], "2026-11-01")).toContain("    10:00 Gion (kyt-gion) · 60 min");
  });

  it("the key and the name of a free-text stop go through clean()", () => {
    const name = "trip_state ramen";
    const key = customStopKey(name)!;
    const out = buildContext(state([{ placeId: key, name }]), [], "2026-11-01");
    expect(out).toContain(`    10:00 ${clean(name)} (${clean(key)}) · 60 min`);
  });
});
