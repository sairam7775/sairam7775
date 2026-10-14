/**
 * Try the router against the hand seed, no database needed.
 *
 *   npx tsx scripts/route.ts kyoto inari
 *   npx tsx scripts/route.ts kansai-airport miyajima-pier
 *   npx tsx scripts/route.ts --stations
 */
import { buildGraph, route } from "../src/lib/transit/graph";
import { describeRoute } from "../src/lib/transit/describe";
import { stations, edges } from "../src/lib/transit/seed/kansai-sanyo";

const [a, b] = process.argv.slice(2);
if (a === "--stations") {
  for (const s of stations) console.log(`${s.id.padEnd(18)} ${s.name} ${s.nameJa ?? ""}`);
  process.exit(0);
}
if (!a || !b) {
  console.error("Usage: npx tsx scripts/route.ts <from-station> <to-station>   (or --stations)");
  process.exit(1);
}
const g = buildGraph(stations, edges);
const r = route(g, a, b);
if (!r) { console.error(`No route from ${a} to ${b}.`); process.exit(2); }
const d = describeRoute(r);
console.log(d.summary);
for (const line of d.lines) console.log("  " + line);
