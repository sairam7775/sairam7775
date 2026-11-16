import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { kyoto as kyotoSeed } from "@/lib/places/seed/kyoto";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import type { InterestTag, TravelPace } from "@/lib/types";
import { planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";
import type { DayPlan, TravellerInput } from "../types";

/** The trap "Arashiyama and Fushimi Inari never share a day" covers the
 *  whole Arashiyama area, not just the bamboo grove: on the live site a day
 *  held Togetsukyo Bridge, the Sagano train and Fushimi Inari together. */
const FUSHIMI = "kyt-fushimi-inari";
const ARASHIYAMA_STATIONS = ["randen-arashiyama", "hankyu-arashiyama", "saga-arashiyama"];
const arashiyama = kyotoSeed.filter((p) => p.station && ARASHIYAMA_STATIONS.includes(p.station)).map((p) => p.id);

const travel = travelFromGraph(buildGraph(stations, edges));
// The real Kyoto seed, treated as verified the way the live database holds it.
const places = kyotoSeed.map((s) => seedToPlaceInput(s));

const traveller = (over: Partial<TravellerInput> = {}): TravellerInput => ({
  pace: "standard",
  interestTags: ["shrines", "history", "nature"],
  energy: 0.5,
  crowdTolerance: 0.5,
  discovery: 0.5,
  excludes: [],
  mobility: [],
  budgetBand: "mid",
  ...over,
});

const clash = (plan: DayPlan) => {
  const ids = plan.items.map((i) => i.placeId);
  return ids.includes(FUSHIMI) ? ids.filter((id) => arashiyama.includes(id)) : [];
};

// Monday 23 Nov to Sunday 29 Nov 2026: every weekday, including the
// Sagano train's Wednesday closure.
const dates = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
const paces: TravelPace[] = ["relaxed", "standard", "packed"];
const interestSets: InterestTag[][] = [["shrines", "history", "nature"], ["nature"], ["shrines"], ["nature", "food", "art"]];
const crowdTolerances = [0.15, 0.9];

describe("the Arashiyama trap covers the whole area", () => {
  it("knows the six Arashiyama-area places in the Kyoto seed", () => {
    expect(arashiyama.sort()).toEqual(
      ["kyt-arashiyama-bamboo", "kyt-monkey-park", "kyt-okochi-sanso", "kyt-sagano-train", "kyt-tenryuji", "kyt-togetsukyo"],
    );
  });

  it("never plans Fushimi Inari on a day with any Arashiyama-area place", () => {
    const bad: string[] = [];
    for (const date of dates)
      for (const pace of paces)
        for (const interestTags of interestSets)
          for (const crowdTolerance of crowdTolerances)
            for (const maxItems of [undefined, 7]) {
              const plan = planDay({ date, cityId: "kyoto-city", places, travel, maxItems, traveller: traveller({ pace, interestTags, crowdTolerance }) });
              const with_ = clash(plan);
              if (with_.length) bad.push(`${date} ${pace} [${interestTags}] crowd ${crowdTolerance} max ${maxItems ?? "-"}: ${with_.join(", ")}`);
            }
    expect(bad).toEqual([]);
  });

  it("keeps Fushimi Inari off a day pinned to Togetsukyo or the Sagano train", () => {
    for (const pinned of ["kyt-togetsukyo", "kyt-sagano-train"]) {
      const plan = planDay({
        date: "2026-11-24", cityId: "kyoto-city", places, travel, maxItems: 7,
        traveller: traveller({ pace: "packed", crowdTolerance: 0.9 }),
        locked: [{ placeId: pinned }],
      });
      expect(plan.items.map((i) => i.placeId)).toContain(pinned);
      expect(plan.items.map((i) => i.placeId)).not.toContain(FUSHIMI);
    }
  });

  it("never puts them together on any day of a week-long trip", () => {
    for (const pace of paces) {
      const trip = planTrip({
        days: dates.map((date) => ({ date, cityId: "kyoto-city" })),
        traveller: traveller({ pace }),
        budgetByCity: { "kyoto-city": "mid" },
        placesByCity: { "kyoto-city": places },
        travel,
      });
      const bad = trip.days.map((d) => clash(d)).filter((c) => c.length);
      expect(bad).toEqual([]);
    }
  });
});

describe("the Kyoto seed's Arashiyama conflicts", () => {
  const byId = new Map(kyotoSeed.map((p) => [p.id, p]));

  it("has every Arashiyama-area place conflict with Fushimi Inari, on both sides", () => {
    const missing: string[] = [];
    for (const id of arashiyama) {
      if (!(byId.get(id)!.conflicts ?? []).includes(FUSHIMI)) missing.push(`${id} → ${FUSHIMI}`);
      if (!(byId.get(FUSHIMI)!.conflicts ?? []).includes(id)) missing.push(`${FUSHIMI} → ${id}`);
    }
    expect(missing).toEqual([]);
  });
});
