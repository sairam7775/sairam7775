import { placeRoute, type Graph } from "@/lib/transit/graph";
import { describeLeg } from "@/lib/transit/describe";
import { HARD_MOBILITY } from "./score";
import type { PlaceInput, TravelFn, TravelLeg } from "./types";
import { copy } from "@/copy";

// Walks straight between two places are estimates from their positions,
// never measured routes. Each figure below is an assumption, chosen to err
// long, and is said as one ("About a 14-min walk").

/** Assumed walking pace: 80 m a minute, the pace Japanese property
 *  listings quote "minutes on foot" at (from memory, not checked against
 *  the listing rules themselves). */
export const WALK_M_PER_MIN = 80;
/** Assumed: streets add a third to the straight line. A planning
 *  allowance, not a measurement. */
export const WALK_DETOUR = 1.3;
/** Assumed: longer than this, a walk between two places is never offered in
 *  place of a train (or of the no-route estimate), however slow the train
 *  looks. Past twenty minutes the straight line says too little about the
 *  streets, and a train is the honest answer. */
export const DIRECT_WALK_MAX_MIN = 20;
/** For a traveller with a hard mobility need (`HARD_MOBILITY`: wheelchair,
 *  limited mobility, step-free), a straight walk only this long: about
 *  300 m, a block or two, where a step or a slope the position can't show
 *  is least likely. Longer, their day goes by the stations as before. */
export const MOBILITY_WALK_MAX_MIN = 5;
/** A straight line knows nothing of hills or moats. Review flagged straight
 *  lines from Zeniarai Benten to Kotoku-in and over Kuzuharaoka, and from
 *  Osaka Castle to the Museum of History. So:
 *  - a hike, or a castle (inside its moats and walls, entered at a few
 *    gates), is never walked to or from in a straight line;
 *  - a steep place (`physicalDemand` 0.5 and over) with a station never has
 *    a straight walk in place of a train. Beside another place by its own
 *    station it keeps the shorter walk: both are a walk from that station
 *    anyway, and the slope is on either one (Kiyomizu-dera down through
 *    Ninenzaka). With no station it walks straight like any place: its
 *    only other time is the flat 45-minute guess (Otokoyama in Himeji). */
export const STEEP_DEMAND = 0.5;
const NO_STRAIGHT_LINE = new Set(["hike", "castle"]);

const blocksStraightWalk = (p: PlaceInput) => NO_STRAIGHT_LINE.has(p.category);
// A steep place with a station never walks straight in place of a train.
// With no station it has only the flat 45-minute guess otherwise, and the
// slope is there whichever way you arrive, so it walks straight like any.
const steepByTrain = (p: PlaceInput) => (p.physicalDemand ?? 0) >= STEEP_DEMAND && p.nearestStation != null;

/** Metres in a straight line between two places, or null without both
 *  positions. Equirectangular: exact enough over a walk. */
export function metresBetween(a: PlaceInput, b: PlaceInput): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Estimated minutes on foot straight from one place to the other, when
 *  both have a position and neither end is in the way of a straight line;
 *  otherwise null. */
export function directWalkMin(a: PlaceInput, b: PlaceInput): number | null {
  if (blocksStraightWalk(a) || blocksStraightWalk(b)) return null;
  const m = metresBetween(a, b);
  return m == null ? null : Math.max(3, Math.ceil((m * WALK_DETOUR) / WALK_M_PER_MIN));
}

/** Door to door over the P3 graph, or on foot when walking straight there
 *  is quicker: the graph alone goes through stations, so the museum across
 *  the road from the castle park looked half an hour away and a day went
 *  to Umeda in between. Returns null when there is no short walk and either
 *  place has no station or the graph has no path — the scheduler then falls
 *  back to an estimate and says so, rather than inventing a number.
 *  `mobility` is the traveller's: a hard need shortens the straight walks. */
export function travelFromGraph(graph: Graph, opts: { mobility?: readonly string[] } = {}): TravelFn {
  const memo = new Map<string, TravelLeg | null>();
  const hardNeed = (opts.mobility ?? []).some((m) => HARD_MOBILITY.has(m));
  const onFoot = (minutes: number, straight: boolean): TravelLeg => ({
    mode: "walk", minutes, fareJpy: 0, fareKind: "exact", lines: [],
    detail: straight ? copy.plan.transit.walkStraight(minutes) : copy.plan.transit.walkOnly(minutes),
  });
  return (a: PlaceInput, b: PlaceInput) => {
    const k = `${a.id}>${b.id}`;
    if (memo.has(k)) return memo.get(k)!;
    let leg: TravelLeg | null = null;
    let direct = directWalkMin(a, b);
    if (direct != null && hardNeed && direct > MOBILITY_WALK_MAX_MIN) direct = null;
    if (a.nearestStation && b.nearestStation) {
      const wa = a.stationWalkMin ?? 10;
      const wb = b.stationWalkMin ?? 10;
      if (a.nearestStation === b.nearestStation) {
        const viaStation = Math.max(3, Math.round((wa + wb) * 0.8));
        leg = direct != null && direct < viaStation ? onFoot(direct, true) : onFoot(viaStation, false);
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
    // route at all, only a short walk, and never to or from a steep place
    // that has a station.
    if (direct != null && direct <= DIRECT_WALK_MAX_MIN && !steepByTrain(a) && !steepByTrain(b) && (!leg || direct < leg.minutes)) leg = onFoot(direct, true);
    memo.set(k, leg);
    return leg;
  };
}
