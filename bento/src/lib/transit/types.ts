/** The transit graph the planner routes over. Pure data — no framework,
 *  no network — so the same types serve the engine, the seed, the GTFS
 *  importer and the tests. */

export type Mode = "rail" | "walk" | "ferry" | "bus";

export interface Station {
  id: string;
  name: string;
  nameJa?: string | null;
  cityId?: string | null;
  lat?: number | null;
  lon?: number | null;
  lines: string[];
}

/** A directed hop. Adjacent stations on a line, or a longer run for
 *  services that skip stops (then `stops` says how many arrivals). */
export interface Edge {
  from: string;
  to: string;
  /** Includes the service where it matters for the traveller:
   *  "JR Nara Line · Local" and "JR Nara Line · Miyakoji Rapid" are
   *  different lines, because changing between them is a transfer. */
  line: string;
  mode: Mode;
  /** Fare-band key, e.g. "jr-west". Null for walks. */
  operator?: string | null;
  km?: number | null;
  minutes: number;
  /** Exact fare for this edge when set; otherwise estimated from bands. */
  fareJpy?: number | null;
  /** Station arrivals including the destination. Default 1. */
  stops?: number;
  /** The thing a friend would tell you: "the Rapid does not stop here". */
  note?: string | null;
}

export interface RouteLeg {
  mode: Mode;
  line: string;
  operator: string | null;
  from: Station;
  to: Station;
  stops: number;
  minutes: number;
  fareJpy: number;
  notes: string[];
}

export interface Route {
  from: Station;
  to: Station;
  legs: RouteLeg[];
  /** Door to door, including transfer time. */
  minutes: number;
  fareJpy: number;
  /** "exact" only when every paid leg carried an explicit fare. Shown to
   *  the traveller as "~¥" otherwise — an estimate must never look precise. */
  fareKind: "exact" | "estimate";
  transfers: number;
}

export interface RouteOptions {
  /** Minutes charged for changing line at a station. Default 5. */
  transferPenaltyMin?: number;
}
