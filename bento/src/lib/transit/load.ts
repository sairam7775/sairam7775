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
    db.from("stations").select("id, name, name_ja, city_id, coords, lines"),
    db.from("station_edges").select("from_station, to_station, line, mode, operator, km, minutes, fare_jpy, stops, note"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const stations: Station[] = (st ?? []).map((s) => {
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

/** PostgREST returns a geography point as hex EWKB: a byte order, the
 *  geometry type (with a flag when an SRID follows), the SRID, then
 *  longitude and latitude as doubles. Anything else reads as no location. */
function readPoint(value: unknown): { lat: number; lon: number } | null {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.match(/../g)!.map((pair) => parseInt(pair, 16)));
  const view = new DataView(bytes.buffer);
  if (bytes.length < 21) return null;
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  if ((type & 0xffff) !== 1) return null;
  const at = type & 0x20000000 ? 9 : 5;
  if (bytes.length < at + 16) return null;
  const lon = view.getFloat64(at, little);
  const lat = view.getFloat64(at + 8, little);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
