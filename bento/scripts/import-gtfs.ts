/**
 * Imports a GTFS feed (unzipped directory) into stations and station_edges.
 *
 *   npx tsx scripts/import-gtfs.ts ./feeds/odpt-tokyo --prefix odpt --dry-run
 *   npx tsx scripts/import-gtfs.ts ./feeds/odpt-tokyo --prefix odpt --apply
 *
 * Feeds: GTFS-JP (gtfs-data.jp) and ODPT (developer.odpt.org) — both need
 * a local download; this repo's CI cannot reach them. Unzip first.
 *
 * Dry run is the default. Check the station and edge counts and a few
 * sample edges before applying: a feed with a wrong stop_sequence or a
 * 24h+ time will produce absurd minutes, and absurd minutes corrupt every
 * itinerary built on them.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apply.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { gtfsToGraph } from "../src/lib/transit/gtfs";

const dir = process.argv[2];
const apply = process.argv.includes("--apply");
const prefixIdx = process.argv.indexOf("--prefix");
const prefix = prefixIdx > -1 ? process.argv[prefixIdx + 1] : undefined;

if (!dir || !existsSync(join(dir, "stop_times.txt"))) {
  console.error("Pass an unzipped GTFS directory containing stop_times.txt.");
  process.exit(1);
}
const read = (f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : undefined);

const { stations, edges } = gtfsToGraph(
  { stops: read("stops.txt")!, routes: read("routes.txt")!, trips: read("trips.txt")!, stop_times: read("stop_times.txt")!, transfers: read("transfers.txt") },
  { idPrefix: prefix },
);

console.log(`${stations.length} stations, ${edges.length} edges (${edges.filter((e) => e.mode === "walk").length} walking transfers)`);
const suspicious = edges.filter((e) => e.minutes > 90 || e.minutes < 1);
if (suspicious.length) console.log(`! ${suspicious.length} edges over 90 min or under 1 — check these before applying`);
for (const e of edges.slice(0, 8)) console.log(`  ${e.from} → ${e.to}  ${e.line}  ${e.minutes} min`);

if (!apply) { console.log("\nDry run. Re-run with --apply to write."); process.exit(0); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
for (const batch of chunk(stations, 500)) {
  const { error } = await db.from("stations").upsert(batch.map((s) => ({
    id: s.id, name: s.name, name_ja: s.nameJa, city_id: s.cityId ?? null,
    coords: s.lat != null && s.lon != null ? `SRID=4326;POINT(${s.lon} ${s.lat})` : null, lines: s.lines,
  })));
  if (error) throw error;
}
for (const batch of chunk(edges, 500)) {
  const { error } = await db.from("station_edges").upsert(batch.map((e) => ({
    from_station: e.from, to_station: e.to, line: e.line, mode: e.mode, operator: e.operator ?? null,
    km: e.km ?? null, minutes: e.minutes, fare_jpy: e.fareJpy ?? null, stops: e.stops ?? 1, note: e.note ?? null,
  })), { onConflict: "from_station,to_station,line" });
  if (error) throw error;
}
console.log("Applied.");
