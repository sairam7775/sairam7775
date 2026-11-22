import { createClient } from "@/lib/supabase/server";
import { selectAll } from "@/lib/supabase/select-all";
import { buildGraph, type Graph } from "./graph";
import { readPoint } from "./point";
import type { Edge, Mode, Station } from "./types";

let cache: { graph: Graph; at: number } | null = null;
// A read under way, so loads that start before it finishes share it (and
// share its failure: one caller's expired session fails the loads that
// joined it). `generation` moves on when the cache is cleared, so a read
// started before that never fills the cache.
let reading: Promise<Graph> | null = null;
let generation = 0;
const TTL_MS = 10 * 60 * 1000;

/** The whole graph from the database, cached per server instance for ten
 *  minutes. Small enough to hold in memory for a long time yet; revisit if
 *  stations pass ~50k. Reference data is readable by any signed-in user
 *  under RLS. */
export async function loadGraph(): Promise<Graph> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.graph;
  if (!reading) {
    const p: Promise<Graph> = readGraph(generation).finally(() => {
      if (reading === p) reading = null;
    });
    reading = p;
  }
  return reading;
}

async function readGraph(gen: number): Promise<Graph> {
  const db = await createClient();
  // Paged on each table's key, so the API's row limit can't cut the graph
  // short; a failed page fails the load and nothing is cached.
  const [st, ed] = await Promise.all([
    selectAll((from, to) =>
      db.from("stations").select("id, name, name_ja, city_id, coords, lines", { count: "exact" }).order("id").range(from, to),
    ),
    selectAll((from, to) =>
      db
        .from("station_edges")
        .select("from_station, to_station, line, mode, operator, km, minutes, fare_jpy, stops, note", { count: "exact" })
        .order("from_station")
        .order("to_station")
        .order("line")
        .range(from, to),
    ),
  ]);

  const stations: Station[] = st.map((s) => {
    const point = readPoint(s.coords);
    return {
      id: s.id,
      name: s.name,
      nameJa: s.name_ja,
      cityId: s.city_id,
      lat: point?.lat,
      lon: point?.lon,
      lines: s.lines ?? [],
    };
  });
  const edges: Edge[] = ed.map((e) => ({
    from: e.from_station, to: e.to_station, line: e.line, mode: (e.mode ?? "rail") as Mode,
    operator: e.operator, km: e.km == null ? null : Number(e.km), minutes: e.minutes,
    fareJpy: e.fare_jpy, stops: e.stops ?? 1, note: e.note,
  }));

  const graph = buildGraph(stations, edges);
  if (gen === generation) cache = { graph, at: Date.now() };
  return graph;
}

export function invalidateGraphCache() {
  cache = null;
  reading = null;
  generation++;
}
