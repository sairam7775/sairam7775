/**
 * Run the Bento Man eval set (src/lib/bento-man/evals/scenarios.ts) against
 * a model. Needs ANTHROPIC_API_KEY. No database: the in-memory store, the
 * drafted corridor as verified, the hand-seeded graph.
 *
 *   npx tsx scripts/eval-bento-man.ts                          # claude-opus-5
 *   npx tsx scripts/eval-bento-man.ts --model claude-sonnet-5  # the D8 test
 *   npx tsx scripts/eval-bento-man.ts --only route-overpacked,fact-lookup
 *   npx tsx scripts/eval-bento-man.ts --effort low --out evals/run.json
 *
 * Grading is mechanical: tools called, tools not called, prose patterns,
 * proposal kind, and the voice lint. A judge model can be added later; the
 * point of this set is that a prompt edit or a model swap fails loudly.
 */
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCENARIOS, type Scenario } from "../src/lib/bento-man/evals/scenarios";
import { MemoryStore } from "../src/lib/bento-man/store.memory";
import { runBentoMan } from "../src/lib/bento-man/chat";
import { costOfAll, DEFAULT_MODEL, type Effort } from "../src/lib/bento-man/cost";
import { voiceLint } from "../src/lib/bento-man/prompt";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};
const model = flag("--model") ?? DEFAULT_MODEL;
const effort = (flag("--effort") ?? "medium") as Effort;
const only = flag("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const out = flag("--out");
const today = "2026-09-15";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. This runs the real model.");
  process.exit(2);
}

interface Result {
  id: string;
  pass: boolean;
  failures: string[];
  tools: string[];
  text: string;
  usage: { input: number; output: number; cached: number };
  costUsd: number;
  ms: number;
}

function grade(s: Scenario, text: string, calls: { name: string; ok: boolean }[], proposal: { route?: unknown; days: unknown[] } | null): string[] {
  const f: string[] = [];
  const e = s.expect;
  const tools = calls.map((c) => c.name);
  // A tool that refused cleanly (is_error) was the tool doing its job, so
  // only a successful call counts against notTools.
  const okTools = calls.filter((c) => c.ok).map((c) => c.name);
  for (const t of e.tools ?? []) if (!tools.includes(t)) f.push(`did not call ${t} (called: ${tools.join(", ") || "none"})`);
  for (const t of e.notTools ?? []) if (okTools.includes(t)) f.push(`called ${t} successfully`);
  for (const re of e.mustMatch ?? []) if (!re.test(text)) f.push(`prose does not match ${re}`);
  for (const re of e.mustNotMatch ?? []) if (re.test(text)) f.push(`prose matches ${re}`);
  if (e.proposal) {
    const kind = !proposal ? "none" : proposal.route ? "route" : proposal.days.length ? "days" : "none";
    if (kind !== e.proposal) f.push(`proposal was ${kind}, expected ${e.proposal}`);
  }
  if (!e.skipVoice) for (const v of voiceLint(text)) f.push(`voice: ${v.detail}`);
  return f;
}

async function main() {
  const client = new Anthropic();
  const list = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
  const results: Result[] = [];
  let totalCost = 0;

  console.log(`Bento Man eval · ${list.length} scenarios · ${model} · effort ${effort}\n`);

  for (const s of list) {
    const store = new MemoryStore(s.setup);
    const t0 = Date.now();
    let text = "";
    let calls: { name: string; ok: boolean }[] = [];
    let proposal: { route?: unknown; days: unknown[] } | null = null;
    let usage = { input: 0, output: 0, cached: 0 };
    let cost = 0;
    let failures: string[];
    try {
      const r = await runBentoMan({ store, client, model, effort, today, message: s.user, persist: false });
      text = r.text;
      calls = r.toolCalls.map((c) => ({ name: c.name, ok: c.ok }));
      proposal = r.proposal;
      usage = { input: r.usage.inputTokens, output: r.usage.outputTokens, cached: r.usage.cacheReadTokens };
      cost = costOfAll(r.usageByModel);
      failures = grade(s, text, calls, proposal);
      if (r.stopReason === "refusal") failures.push("model refused");
    } catch (e) {
      failures = [`error: ${e instanceof Error ? e.message : String(e)}`];
    }
    totalCost += cost;
    const ms = Date.now() - t0;
    const tools = calls.map((c) => (c.ok ? c.name : `${c.name}(err)`));
    results.push({ id: s.id, pass: failures.length === 0, failures, tools, text, usage, costUsd: cost, ms });
    console.log(`${failures.length ? "✗" : "✓"} ${s.id.padEnd(28)} ${String(ms).padStart(6)}ms  $${cost.toFixed(4)}  ${tools.join(",") || "-"}`);
    for (const f of failures) console.log(`      ${f}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed · $${totalCost.toFixed(3)} · cache reads ${results.reduce((s, r) => s + r.usage.cached, 0).toLocaleString("en")} tokens`);

  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ model, effort, today, passed, total: results.length, costUsd: totalCost, results }, null, 2));
    console.log(`written ${out}`);
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
