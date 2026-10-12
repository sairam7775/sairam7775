/** A stand-in for the Anthropic client, for local development without an
 *  API key. BENTO_MAN_MOCK=1 turns it on; it is never on in production.
 *
 *  Only the model is faked. The traveller's message is matched against a
 *  few keywords to pick a tool, and from there the real chat loop runs: the
 *  real tools, the real engine, the real store, real proposals. The reply
 *  prose is canned and says so. Usage is zero, so nothing counts against
 *  the spend cap. */
import type Anthropic from "@anthropic-ai/sdk";
import { INTEREST_TAGS } from "@/lib/types";

export const MOCK_MODEL = "mock";

export function mockModeEnabled(): boolean {
  return process.env.BENTO_MAN_MOCK === "1" && process.env.NODE_ENV !== "production";
}

type Params = { messages: Anthropic.Beta.BetaMessageParam[] };
type Block = Anthropic.Beta.BetaContentBlock;
type ToolCall = { name: string; input: Record<string, unknown> };

const HELP = [
  "(Mock mode — no model is running, so I only understand a few phrasings.)",
  "Try one of these:",
  "• \"dates 2026-11-20 to 2026-11-29\"",
  "• \"I like a relaxed pace, food and temples\"",
  "• \"suggest a route\"",
  "• \"plan my days\"",
  "• \"start later on 2026-11-21\"",
  "• \"tell me about Fushimi Inari\"",
  "• \"from kyoto to osaka\"",
].join("\n");

// ------------------------------------------------------------- the script

/** The traveller's words, without the trip state the chat loop prepends. */
function travellerText(content: Anthropic.Beta.BetaMessageParam["content"]): string {
  const text = typeof content === "string" ? content : content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  const end = text.lastIndexOf("</trip_state>");
  return (end >= 0 ? text.slice(end + "</trip_state>".length) : text).trim();
}

/** The first tool for a traveller message, or null for the help text. */
export function pickTool(message: string): ToolCall | null {
  const m = message.toLowerCase();
  const dates = m.match(/\d{4}-\d{2}-\d{2}/g) ?? [];

  if (dates.length >= 2 && /\b(dates?|from|to|trip)\b/.test(m)) {
    return { name: "set_trip_dates", input: { start_date: dates[0], end_date: dates[1] } };
  }
  if (dates.length === 1 && /\b(later|earlier|start)\b/.test(m)) {
    const time = m.match(/\b(\d{1,2}):(\d{2})\b/);
    const at = time ? `${time[1].padStart(2, "0")}:${time[2]}` : "10:00";
    return { name: "replan_day", input: { date: dates[0], ops: [{ op: "start_at", time: at }] } };
  }

  const pace = m.match(/\b(relaxed|standard|packed)\b/)?.[1];
  const tags = INTEREST_TAGS.filter((t) => m.includes(t.id) || m.includes(t.label.toLowerCase())).map((t) => t.id);
  if (pace || tags.length) {
    return { name: "set_preferences", input: { ...(pace ? { pace } : {}), ...(tags.length ? { interest_tags: tags } : {}) } };
  }

  if (/\b(suggest|route|where should|which cities)\b/.test(m)) return { name: "suggest_route", input: {} };
  if (/\b(plan|itinerary|schedule)\b/.test(m)) return { name: "plan_days", input: dates.length ? { dates: [{ date: dates[0] }] } : {} };

  const between = m.match(/\bfrom\s+([\w-]+)\s+to\s+([\w-]+)/);
  if (between) return { name: "route_between", input: { from: between[1], to: between[2] } };

  const about = message.match(/\b(?:tell me about|what is|what's|about)\s+(.+?)[?.!]*$/i);
  if (about) return { name: "get_place", input: { query: about[1].slice(0, 80) } };

  return null;
}

const PROPOSES = new Set(["propose_route", "plan_days", "replan_day"]);

/** What to say, or do next, once a tool has answered. */
export function afterTool(name: string, result: string, isError: boolean): { text: string; next?: ToolCall } {
  if (isError) return { text: `(Mock) ${name} said no: ${result}` };

  if (name === "suggest_route") {
    try {
      const s = JSON.parse(result) as { cities?: { city_id: string; nights: number; reason: string }[] };
      if (s.cities?.length) {
        return {
          text: "(Mock) Bento's starting route — I'll put it up as a proposal.",
          next: { name: "propose_route", input: { cities: s.cities.map((c) => ({ city_id: c.city_id, nights: c.nights, reason: c.reason })) } },
        };
      }
    } catch {
      // fall through to the plain summary
    }
  }

  if (PROPOSES.has(name)) return { text: "(Mock) Here is what the engine came up with. Accept or reject it below." };

  const preview = result.length > 600 ? `${result.slice(0, 600)}…` : result;
  return { text: `(Mock) ${name} returned:\n${preview}` };
}

// ------------------------------------------------------------- the client

let seq = 0;

function message(content: Block[], stopReason: "end_turn" | "tool_use"): Anthropic.Beta.BetaMessage {
  return {
    id: `msg_mock_${++seq}`,
    type: "message",
    role: "assistant",
    model: MOCK_MODEL,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}

function respond(params: Params): Anthropic.Beta.BetaMessage {
  const last = params.messages[params.messages.length - 1];
  const content = last?.content ?? "";

  // A tool has just answered: narrate it, or chain the next call.
  if (Array.isArray(content) && content.some((b) => b.type === "tool_result")) {
    const prev = params.messages[params.messages.length - 2];
    const uses = Array.isArray(prev?.content) ? prev.content.filter((b) => b.type === "tool_use") : [];
    const lines: string[] = [];
    for (const r of content) {
      if (r.type !== "tool_result") continue;
      const use = uses.find((u) => u.type === "tool_use" && u.id === r.tool_use_id);
      const name = use?.type === "tool_use" ? use.name : "tool";
      const body = typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? "");
      const step = afterTool(name, body, Boolean(r.is_error));
      if (step.next) {
        return message(
          [
            { type: "text", text: step.text, citations: null },
            { type: "tool_use", id: `toolu_mock_${++seq}`, name: step.next.name, input: step.next.input },
          ] as Block[],
          "tool_use",
        );
      }
      lines.push(step.text);
    }
    return message([{ type: "text", text: lines.join("\n\n"), citations: null }] as Block[], "end_turn");
  }

  const call = pickTool(travellerText(content));
  if (!call) return message([{ type: "text", text: HELP, citations: null }] as Block[], "end_turn");
  return message([{ type: "tool_use", id: `toolu_mock_${++seq}`, name: call.name, input: call.input }] as Block[], "tool_use");
}

/** The slice of the message stream the chat loop uses: `on("text")` and
 *  `finalMessage()`. Text is fed out in small pieces so the UI streams. */
function fakeStream(params: Params) {
  const listeners: ((delta: string) => void)[] = [];
  return {
    on(event: string, cb: (delta: string) => void) {
      if (event === "text") listeners.push(cb);
      return this;
    },
    async finalMessage() {
      const msg = respond(params);
      for (const block of msg.content) {
        if (block.type !== "text") continue;
        for (const piece of block.text.match(/[\s\S]{1,24}/g) ?? []) {
          for (const cb of listeners) cb(piece);
          await new Promise((r) => setTimeout(r, 15));
        }
      }
      return msg;
    },
  };
}

/** A pasted confirmation, read with regexes instead of a model. Rough on
 *  purpose: the traveller reviews every field before saving anyway. */
export function mockParse(text: string): string {
  const t = text.replace(/<\/?confirmation>/g, "").replace(/Return the JSON\.\s*$/, "").trim();
  const lower = t.toLowerCase();
  const type = /\b(flight|airline|boarding|depart)/.test(lower)
    ? "flight"
    : /\b(hotel|ryokan|hostel|check-in|check in)/.test(lower)
      ? "accommodation"
      : /\b(train|shinkansen|bus|ferry)/.test(lower)
        ? "transport"
        : /\b(table|restaurant|reservation for)/.test(lower)
          ? "restaurant"
          : /\b(ticket|tour|admission|entry)/.test(lower)
            ? "activity"
            : "other";
  const dates = t.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const times = t.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [];
  // The first code-looking token (letters and at least one digit) after a
  // word that introduces one — "Booking reference: HK12345".
  const reference = t.match(/\b(?:[Rr]eference|[Rr]ef|REF|[Cc]onfirmation|[Bb]ooking|PNR)\b[\s\S]{0,30}?\b(?=[A-Z0-9-]*\d)([A-Z0-9-]{5,20})\b/)?.[1] ?? null;
  const money = t.match(/\b(JPY|USD|EUR|GBP|INR|AUD|CAD|SGD)\s?([\d,]+(?:\.\d+)?)/i) ?? t.match(/([¥$€£])\s?([\d,]+(?:\.\d+)?)/);
  const symbol: Record<string, string> = { "¥": "JPY", $: "USD", "€": "EUR", "£": "GBP" };
  const firstLine = t.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "Booking";

  return JSON.stringify({
    type,
    title: firstLine.slice(0, 160),
    provider: null,
    reference,
    starts_on: dates[0] ?? null,
    starts_at_time: times[0] ?? null,
    ends_on: dates[1] ?? null,
    ends_at_time: times[1] ?? null,
    from_place: null,
    to_place: null,
    cost_amount: money ? Number(money[2].replace(/,/g, "")) : null,
    cost_currency: money ? (symbol[money[1]] ?? money[1].toUpperCase()) : null,
    notes: "Read by mock mode — check every field.",
  });
}

/** The two calls the app makes, and nothing else. */
export function createMockClient(): Anthropic {
  return {
    beta: { messages: { stream: (params: Params) => fakeStream(params) } },
    messages: {
      create: async (params: Params) => {
        const last = params.messages[params.messages.length - 1];
        const text = typeof last?.content === "string" ? last.content : "";
        return message([{ type: "text", text: mockParse(text), citations: null }] as Block[], "end_turn");
      },
    },
  } as unknown as Anthropic;
}
