import { placeRoute, type Graph } from "@/lib/transit/graph";
import { describeLeg } from "@/lib/transit/describe";
import type { PlaceInput, TravelFn, TravelLeg } from "./types";
import { copy } from "@/copy";

/** Walking pace: 80 m a minute, the figure Japanese property listings must
 *  use for "minutes on foot". */
export const WALK_M_PER_MIN = 80;
/** Streets are not straight lines: a planning allowance, not a measurement. */
export const WALK_DETOUR = 1.3;
/** Longer than this, a walk between two places is never offered in place of
 *  a train (or of the no-route estimate), however slow the train looks. */
export const DIRECT_WALK_MAX_MIN = 20;

/** Metres in a straight line between two places, or null without both
 *  positions. Equirectangular: exact enough over a walk. */
export function metresBetween(a: PlaceInput, b: PlaceInput): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Minutes on foot straight from one place to the other, when both have a
 *  position; otherwise null. */
export function directWalkMin(a: PlaceInput, b: PlaceInput): number | null {
  const m = metresBetween(a, b);
  return m == null ? null : Math.max(3, Math.ceil((m * WALK_DETOUR) / WALK_M_PER_MIN));
}

/** Door to door over the P3 graph, or on foot when walking straight there
 *  is quicker: the graph alone goes through stations, so the museum across
 *  the road from the castle park looked half an hour away and a day went
 *  to Umeda in between. Returns null when there is no short walk and either
 *  place has no station or the graph has no path — the scheduler then falls
 *  back to an estimate and says so, rather than inventing a number. */
export function travelFromGraph(graph: Graph): TravelFn {
  const memo = new Map<string, TravelLeg | null>();
  const onFoot = (minutes: number): TravelLeg => ({ mode: "walk", minutes, fareJpy: 0, fareKind: "exact", detail: copy.plan.transit.walkOnly(minutes), lines: [] });
  return (a: PlaceInput, b: PlaceInput) => {
    const k = `${a.id}>${b.id}`;
    if (memo.has(k)) return memo.get(k)!;
    let leg: TravelLeg | null = null;
    const direct = directWalkMin(a, b);
    if (a.nearestStation && b.nearestStation) {
      const wa = a.stationWalkMin ?? 10;
      const wb = b.stationWalkMin ?? 10;
      if (a.nearestStation === b.nearestStation) {
        const viaStation = Math.max(3, Math.round((wa + wb) * 0.8));
        leg = onFoot(direct != null ? Math.min(direct, viaStation) : viaStation);
      } else {
        // A day's hops always take the fastest route, whatever city each
        // station is filed under: the fewer-changes window is for journeys
        // between cities, and 20 minutes would double a short hop.
        const r = placeRoute(graph, { stationId: a.nearestStation, walkMin: wa }, { stationId: b.nearestStation, walkMin: wb }, { fewerChangesSlackMin: 0 });
        if (r) {
          const lines = r.legs.map((l) => describeLeg(l, r.fareKind));
          const first = r.legs.find((l) => l.mode !== "walk");
          leg = {
            mode: first ? first.mode : "walk",
            minutes: r.minutes,
            fareJpy: r.fareJpy,
            fareKind: r.fareKind,
            unpricedRides: r.unpricedRides,
            detail: copy.plan.transit.door(wa, r.from.name, lines.join(copy.plan.transit.legJoin), wb),
            lines,
          };
        }
      }
    }
    // Two places by one station were already a walk (via the station):
    // walking straight is never longer. In place of a train, or of no
    // route at all, only a short walk.
    if (direct != null && direct <= DIRECT_WALK_MAX_MIN && (!leg || direct < leg.minutes)) leg = onFoot(direct);
    memo.set(k, leg);
    return leg;
  };
}
