/**
 * Plan a day over the Kyoto fixture with the real corridor router. No
 * database needed — this is the engine on its own.
 *
 *   npx tsx scripts/plan-day.ts                # Wed 25 Nov, the owner profile
 *   npx tsx scripts/plan-day.ts 2026-11-23     # a Monday
 *   npx tsx scripts/plan-day.ts 2026-11-25 --pin kyt-sanjusangendo@10:00
 */
import { buildGraph } from "../src/lib/transit/graph";
import { stations, edges } from "../src/lib/transit/seed/kansai-sanyo";
import { planDay } from "../src/lib/engine/schedule";
import { travelFromGraph } from "../src/lib/engine/travel";
import { kyoto, owner } from "../src/lib/engine/__fixtures__/kyoto";

const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? "2026-11-25";
const pinIdx = args.indexOf("--pin");
const locked = pinIdx > -1 ? [args[pinIdx + 1]].map((s) => {
  const [placeId, hhmm] = s.split("@");
  const startMin = hhmm ? Number(hhmm.split(":")[0]) * 60 + Number(hhmm.split(":")[1]) : null;
  return { placeId, startMin };
}) : [];

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const yen = (n: number, kind: string) => `${kind === "exact" ? "" : "~"}¥${n.toLocaleString("en")}`;

const plan = planDay({
  date, cityId: "kyoto-city", places: kyoto, traveller: owner,
  travel: travelFromGraph(buildGraph(stations, edges)), locked,
});

const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
console.log(`\nKyoto · ${weekday} ${date} · ${owner.pace} pace\n`);

// One timeline: stops and meals in clock order.
type Row = { start: number; end: number; render: () => void };
const rows: Row[] = plan.items.map((it) => ({
  start: it.startMin, end: it.endMin, render: () => {
    console.log(`${clock(it.startMin)}–${clock(it.endMin)}  ${it.name}${it.locked ? "  [pinned]" : ""}`);
    if (it.arriveBy) console.log(`         ↳ ${it.arriveBy.detail}`);
    console.log(`         ${it.reason}`);
    if (it.alternatives.length) console.log(`         alternatives: ${it.alternatives.map((a) => `${a.name} (${a.whyNot})`).join(" · ")}`);
  },
}));
for (const m of plan.meals) rows.push({ start: m.startMin, end: m.endMin, render: () => console.log(`${clock(m.startMin)}–${clock(m.endMin)}  Lunch`) });
rows.sort((a, b) => a.start - b.start).forEach((r) => r.render());

console.log(`\n${Math.floor(plan.activeMin / 60)}h ${plan.activeMin % 60}m active of ${plan.budgetMin / 60}h · ${plan.slackMin} min slack · places ¥${plan.placesJpy.toLocaleString("en")} + fares ${yen(plan.faresJpy, plan.fareKind)}`);

console.log(`\nConsidered, left out:`);
for (const r of plan.considered) console.log(`  – ${r.name.padEnd(28)} ${r.term.padEnd(18)} ${r.detail}`);
if (plan.warnings.length) {
  console.log(`\nWarnings:`);
  for (const w of plan.warnings) console.log(`  ! ${w}`);
}
console.log();
