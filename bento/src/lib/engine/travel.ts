import { placeRoute, type Graph } from "@/lib/transit/graph";
import { describeLeg } from "@/lib/transit/describe";
import type { PlaceInput, TravelFn, TravelLeg } from "./types";

/** Door to door over the P3 graph. Returns null when either place has no
 *  station or the graph has no path — the scheduler then falls back to an
 *  estimate and says so, rather than inventing a number. */
export function travelFromGraph(graph: Graph): TravelFn {
  const memo = new Map<string, TravelLeg | null>();
  return (a: PlaceInput, b: PlaceInput) => {
    const k = `${a.id}>${b.id}`;
    if (memo.has(k)) return memo.get(k)!;
    let leg: TravelLeg | null = null;
    if (a.nearestStation && b.nearestStation) {
      const wa = a.stationWalkMin ?? 10;
      const wb = b.stationWalkMin ?? 10;
      if (a.nearestStation === b.nearestStation) {
        const minutes = Math.max(3, Math.round((wa + wb) * 0.8));
        leg = { mode: "walk", minutes, fareJpy: 0, fareKind: "exact", detail: `Walk · ${minutes} min`, lines: [] };
      } else {
        const r = placeRoute(graph, { stationId: a.nearestStation, walkMin: wa }, { stationId: b.nearestStation, walkMin: wb });
        if (r) {
          const lines = r.legs.map((l) => describeLeg(l, r.fareKind));
          const first = r.legs.find((l) => l.mode !== "walk");
          leg = {
            mode: first ? first.mode : "walk",
            minutes: r.minutes,
            fareJpy: r.fareJpy,
            fareKind: r.fareKind,
            detail: `Walk ${wa} min to ${r.from.name}, ${lines.join(", then ")}, walk ${wb} min`,
            lines,
          };
        }
      }
    }
    memo.set(k, leg);
    return leg;
  };
}
