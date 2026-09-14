import type { Route, RouteLeg } from "./types";

const yen = (n: number, kind: Route["fareKind"]) => `${kind === "exact" ? "" : "~"}¥${n.toLocaleString("en")}`;

/** The leg as a traveller can follow it. Not "20 minutes" — which line,
 *  how many stops, what it costs, and the thing that trips people up. */
export function describeLeg(leg: RouteLeg, fareKind: Route["fareKind"]): string {
  if (leg.mode === "walk") {
    return `Walk · ${leg.from.name} → ${leg.to.name} · ${leg.minutes} min`;
  }
  const stops = leg.stops === 1 ? "nonstop" : `${leg.stops} stops`;
  const fare = leg.fareJpy ? ` · ${yen(leg.fareJpy, fareKind)}` : "";
  const notes = leg.notes.length ? ` — ${leg.notes.join("; ")}` : "";
  return `${leg.line} · ${leg.from.name} → ${leg.to.name} · ${stops} · ${leg.minutes} min${fare}${notes}`;
}

export function describeRoute(r: Route): { summary: string; lines: string[] } {
  const h = Math.floor(r.minutes / 60);
  const m = r.minutes % 60;
  const dur = h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
  const fare = r.fareJpy ? yen(r.fareJpy, r.fareKind) : "free";
  const changes = r.transfers === 0 ? "no changes" : r.transfers === 1 ? "1 change" : `${r.transfers} changes`;
  return {
    summary: `${r.from.name} → ${r.to.name} · ${dur} · ${fare} · ${changes}`,
    lines: r.legs.map((l) => describeLeg(l, r.fareKind)),
  };
}
