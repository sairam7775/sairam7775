import { createClient } from "@/lib/supabase/server";
import { buildGraph, type Graph } from "./graph";
import type { Edge, Mode, Station } from "./types";

let cache: { graph: Graph; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** The whole graph from the database, cached per server instance. Small
 *  enough to hold in memory for a long time yet; revisit if stations pass
 *  ~50k. Reference data is readable by any signed-in user under RLS. */
export async function loadGraph(): Promise<Graph> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.graph;

  const db = await createClient();
  const [{ data: st, error: e1 }, { data: ed, error: e2 }] = await Promise.all([
    db.from("stations").select("id, name, name_ja, city_id, lines"),
    db.from("station_edges").select("from_station, to_station, line, mode, operator, km, minutes, fare_jpy, stops, note"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const stations: Station[] = (st ?? []).map((s) => ({
    id: s.id, name: s.name, nameJa: s.name_ja, cityId: s.city_id, lines: s.lines ?? [],
  }));
  const edges: Edge[] = (ed ?? []).map((e) => ({
    from: e.from_station, to: e.to_station, line: e.line, mode: (e.mode ?? "rail") as Mode,
    operator: e.operator, km: e.km == null ? null : Number(e.km), minutes: e.minutes,
    fareJpy: e.fare_jpy, stops: e.stops ?? 1, note: e.note,
  }));

  const graph = buildGraph(stations, edges);
  cache = { graph, at: Date.now() };
  return graph;
}

export function invalidateGraphCache() {
  cache = null;
}
