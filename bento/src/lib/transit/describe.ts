import type { Route, RouteLeg } from "./types";
import { copy } from "@/copy";

const yen = (n: number, kind: Route["fareKind"]) => copy.plan.transit.yen(n.toLocaleString(copy.locale), kind !== "exact");

/** The leg as a traveller can follow it. Not "20 minutes" — which line,
 *  how many stops, what it costs, and the thing that trips people up. */
export function describeLeg(leg: RouteLeg, fareKind: Route["fareKind"]): string {
  if (leg.mode === "walk") {
    return copy.plan.transit.walk(leg.from.name, leg.to.name, leg.minutes);
  }
  const stops = leg.stops === 1 ? copy.plan.transit.nonstop : copy.plan.transit.stops(leg.stops);
  const fare = leg.fareJpy ? yen(leg.fareJpy, fareKind) : "";
  return copy.plan.transit.ride(leg.line, leg.from.name, leg.to.name, stops, leg.minutes, fare, leg.notes.join(copy.plan.transit.noteJoin));
}

export function describeRoute(r: Route): { summary: string; lines: string[] } {
  const h = Math.floor(r.minutes / 60);
  const m = r.minutes % 60;
  const dur = copy.plan.transit.duration(h, m);
  const unpriced = r.unpricedRides ?? 0;
  const missing = copy.plan.transit.faresMissing(unpriced);
  const fare = unpriced
    ? r.fareJpy ? copy.plan.transit.farePlusMissing(yen(r.fareJpy, r.fareKind), missing) : copy.plan.transit.fareMissing
    : r.fareJpy ? yen(r.fareJpy, r.fareKind) : copy.plan.transit.free;
  const changes = copy.plan.transit.changes(r.transfers);
  return {
    summary: copy.plan.transit.summary(r.from.name, r.to.name, dur, fare, changes),
    lines: r.legs.map((l) => describeLeg(l, r.fareKind)),
  };
}
