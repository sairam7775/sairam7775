/** A turn has a deadline under the route's maxDuration: no model round
 *  starts too close to it, each call gets only the time left, and a turn
 *  out of time ends the way a turn out of tool rounds does — with its
 *  proposal saved and every spend hold settled. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { nextContent, type ChatStreamEvent } from "@/app/trips/[id]/chat-stream";
import { MIN_CALL_MS, runBentoMan, TURN_DEADLINE_MS, type CallHold } from "../chat";
import { ZERO_USAGE } from "../cost";
import { ProviderCallError, type ChatProvider, type ModelRequest, type ModelResult, type ToolCall } from "../provider";
import { MemoryStore } from "../store.memory";

afterEach(() => { vi.restoreAllMocks(); });

const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
const routed = () => new MemoryStore({ trip: nov, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }] });
const result = (o: Partial<ModelResult> = {}): ModelResult => ({ text: "", toolCalls: [], stopReason: "end", usage: { ...ZERO_USAGE, inputTokens: 10, outputTokens: 10 }, model: "claude-opus-5", ...o });
const uses = (call: Omit<ToolCall, "id">, text = "") => result({ text, toolCalls: [{ id: "t1", ...call }], stopReason: "tool_use" });
const PLAN_MIYAJIMA = { name: "plan_days", input: { dates: [{ date: "2026-11-28", city_id: "miyajima" }] } };
const ADD_MIYAJIMA = { name: "replan_day", input: { date: "2026-11-28", ops: [{ op: "add", place_id: "miy-itsukushima" }] } };

/** A clock the test moves: each model call takes `took[i]` ms (default 1 s). */
function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

/** Holds that record how each was settled. */
function holds() {
  const settled: unknown[] = [];
  let taken = 0;
  const spend = { hold: async (): Promise<CallHold> => { taken++; return { settle: async (u) => { settled.push(u); } }; } };
  return { spend, settled, taken: () => taken };
}

/** One turn as the browser folds it, with the order of replace and save. */
async function turn(steps: ((request: ModelRequest) => Promise<ModelResult>)[], opts: { deadlineIn?: number; time?: ReturnType<typeof clock> } = {}) {
  const store = routed();
  const time = opts.time ?? clock();
  const call = vi.fn<ChatProvider["call"]>();
  for (const s of steps) call.mockImplementationOnce(s);
  call.mockImplementation(steps.at(-1)!);
  const spend = holds();
  let content = "";
  const order: string[] = [];
  const apply = (ev: ChatStreamEvent) => { content = nextContent(content, ev); };
  const append = store.append.bind(store);
  store.append = (role, ...rest) => { if (role === "assistant") order.push("saved"); return append(role, ...rest); };
  const run = runBentoMan({
    store, provider: { model: "claude-opus-5", call }, today: "2026-09-15", message: "Make the 28th a day trip to Miyajima.",
    spend: spend.spend, deadline: time.now() + (opts.deadlineIn ?? TURN_DEADLINE_MS), now: time.now,
    events: {
      onText: (delta) => apply({ type: "text", delta }),
      onTool: (name, phase, ok) => apply({ type: "tool", name, phase, ok }),
      onReplace: (text) => { order.push("replace"); apply({ type: "replace", text }); },
    },
  });
  return { run, store, call, spend, order, time, content: () => content };
}

/** A model step that takes `ms` of the turn's time, streams its text and answers. */
const step = (time: ReturnType<typeof clock>, ms: number, answer: ModelResult) => async (request: ModelRequest) => {
  time.advance(ms);
  if (answer.text) request.onText?.(answer.text);
  return answer;
};

describe("a chat turn's deadline", () => {
  it("sits under the route's maxDuration with room to settle and save", async () => {
    const { maxDuration } = await import("@/app/api/chat/route");
    // After the deadline: the last call's settle, the reply's save and the
    // route's own settle, each bounded by the Supabase fetch timeout.
    expect(TURN_DEADLINE_MS + 30_000).toBeLessThanOrEqual(maxDuration * 1000);
    expect(MIN_CALL_MS).toBeGreaterThan(0);
  });

  it("starts no new round when too little time is left, and ends like a capped turn with the proposal saved", async () => {
    const time = clock();
    const t = await turn([step(time, TURN_DEADLINE_MS - MIN_CALL_MS + 1, uses(PLAN_MIYAJIMA))], { time });
    const r = await t.run;
    expect(t.call).toHaveBeenCalledTimes(1);
    expect(t.spend.taken()).toBe(1);
    expect(t.spend.settled).toHaveLength(1);
    expect(t.spend.settled[0]).toMatchObject({ model: "claude-opus-5", inputTokens: 10, outputTokens: 10 });
    expect(r.proposal?.days[0].cityId).toBe("miyajima");
    expect(r.text).toBe(copy.chat.cappedSuggestion);
    expect(r.text).not.toBe(copy.chat.suggestion);
    expect(r.assistantMessageId).not.toBeNull();
    const saved = (await t.store.history(5)).at(-1)!;
    expect(saved.content).toBe(r.text);
    expect(t.content()).toBe(r.text);
  });

  it("says there was no reply when time runs out with nothing proposed", async () => {
    const time = clock();
    const t = await turn([step(time, TURN_DEADLINE_MS, uses(ADD_MIYAJIMA))], { time });
    const r = await t.run;
    expect(t.call).toHaveBeenCalledTimes(1);
    expect(r.proposal).toBeNull();
    expect(r.text).toBe(copy.chat.noReply);
    expect((await t.store.history(5)).at(-1)!.content).toBe(r.text);
  });

  it("keeps going while there is time, and gives each call only the time left", async () => {
    const time = clock();
    const timeouts = vi.spyOn(AbortSignal, "timeout");
    const signals: (AbortSignal | undefined)[] = [];
    const record = (s: (request: ModelRequest) => Promise<ModelResult>) => async (request: ModelRequest) => { signals.push(request.signal); return s(request); };
    const t = await turn([record(step(time, 30_000, uses(PLAN_MIYAJIMA))), record(step(time, 5_000, result({ text: "Miyajima on the 28th." })))], { time });
    const r = await t.run;
    expect(t.call).toHaveBeenCalledTimes(2);
    expect(r.text).toBe("Miyajima on the 28th.");
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
    expect(timeouts.mock.calls.map(([ms]) => ms)).toEqual([TURN_DEADLINE_MS, TURN_DEADLINE_MS - 30_000]);
  });

  it("ends politely when a later call is cut off by time: its text dropped, its hold settled with what it used, the proposal saved", async () => {
    const time = clock();
    const cut = async (request: ModelRequest): Promise<ModelResult> => {
      time.advance(20_000);
      request.onText?.("Half a sen");
      throw new ProviderCallError("Gemini call timed out", "gemini-3.8-flash", { ...ZERO_USAGE, inputTokens: 500, outputTokens: 3 }, undefined, true);
    };
    const t = await turn([step(time, 1_000, uses(PLAN_MIYAJIMA, "Planning the island.")), cut], { time });
    const r = await t.run;
    expect(r.proposal?.days[0].cityId).toBe("miyajima");
    expect(r.text).toBe(`Planning the island.\n\n${copy.chat.cappedSuggestion}`);
    expect(r.text).not.toContain("Half a sen");
    expect(t.content()).toBe(r.text);
    expect(t.order).toEqual(["replace", "saved"]);
    expect(t.spend.settled).toHaveLength(2);
    expect(t.spend.settled[1]).toMatchObject({ model: "gemini-3.8-flash", inputTokens: 500, outputTokens: 3 });
    expect(r.usageByModel["gemini-3.8-flash"]).toMatchObject({ inputTokens: 500, outputTokens: 3 });
  });

  it("still fails a turn whose first call times out (the route says it took too long), settling its hold", async () => {
    const t = await turn([async () => { throw new ProviderCallError("Gemini call timed out", "gemini-3.8-flash", undefined, undefined, true); }]);
    const err = await t.run.catch((e) => e);
    expect(err).toBeInstanceOf(ProviderCallError);
    expect(err.timedOut).toBe(true);
    expect(t.spend.settled).toEqual([null]);
  });

  it("doesn't start a first call it has no time for: no hold, no model call, a timed-out error", async () => {
    const t = await turn([step(clock(), 0, result({ text: "never" }))], { deadlineIn: MIN_CALL_MS - 1 });
    const err = await t.run.catch((e) => e);
    expect(err).toBeInstanceOf(ProviderCallError);
    expect(err.timedOut).toBe(true);
    expect(t.call).not.toHaveBeenCalled();
    expect(t.spend.taken()).toBe(0);
  });

  it("is off without a deadline (the eval): no signal is passed", async () => {
    const store = routed();
    const call = vi.fn<ChatProvider["call"]>(async () => result({ text: "Hi." }));
    await runBentoMan({ store, provider: { model: "claude-opus-5", call }, today: "2026-09-15", message: "hi" });
    expect(call.mock.calls[0][0].signal).toBeUndefined();
  });
});
