import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/guards/rate-limit";
import { readJsonLimited } from "@/lib/guards/read-json";
import { reserveSpend, SpendCapExceeded } from "@/lib/guards/spend";
import { runBentoMan } from "@/lib/bento-man/chat";
import { chainBoundUsd, configuredEffort, configuredFallbacks, configuredModel } from "@/lib/bento-man/cost";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { createMockClient, mockModeEnabled } from "@/lib/bento-man/mock";
import { AnthropicProvider } from "@/lib/bento-man/provider.anthropic";
import { GeminiProvider } from "@/lib/bento-man/provider.gemini";
import { configuredProvider, providerKeyVariable, ProviderCallError } from "@/lib/bento-man/provider";
import { copy } from "@/copy";

/** POST /api/chat — one turn with Bento Man, streamed as server-sent events.
 *
 *  Order of the guards matters: auth, then the per-user throttle, then the
 *  spend cap, and only then a model call. Usage is recorded after the turn
 *  whatever happened to it, so a failed turn still counts what it cost. */
const Body = z.object({
  tripId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});
// 16 KiB fits a 2,000-unit message even when JSON escapes every unit.
const MAX_BODY_BYTES = 16 * 1024;

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: copy.server.signInFirst }, { status: 401 });

  const limit = await rateLimit(db, "chat");
  if (!limit.allowed) {
    return NextResponse.json({ error: copy.server.slowDown }, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });
  }

  const body = await readJsonLimited(req, MAX_BODY_BYTES);
  if (!body.ok && body.reason === "too-large") {
    return NextResponse.json({ error: copy.server.bodyTooLarge }, { status: 413 });
  }
  const parsed = Body.safeParse(body.ok ? body.value : null);
  if (!parsed.success) return NextResponse.json({ error: copy.server.chatEmpty }, { status: 400 });
  const { tripId, message } = parsed.data;

  const mock = mockModeEnabled();
  const providerName = configuredProvider();
  const keyVariable = providerKeyVariable(providerName);
  if (!mock && !process.env[keyVariable]) {
    console.error(`Bento Man is off: ${keyVariable} is not set.`);
    return NextResponse.json({ error: copy.server.chatOff }, { status: 503 });
  }

  // Hold budget for one model call at a time, sized to the most a call can
  // cost, so parallel turns see each other's holds. The first hold is taken
  // here, where a refusal can still be a plain 402.
  const model = configuredModel(providerName);
  const fallbacks = mock ? [] : configuredFallbacks(providerName, model);
  const hold = () => reserveSpend(user.id, "chat", chainBoundUsd([model, ...fallbacks], "chat"));
  let first: Awaited<ReturnType<typeof hold>> | null;
  try {
    first = await hold();
  } catch (e) {
    if (e instanceof SpendCapExceeded) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }
  const spend = {
    hold: async () => {
      if (first) {
        const h = first;
        first = null;
        return h;
      }
      return hold();
    },
  };

  const store = new SupabaseStore(db, tripId, user.id);
  const provider = mock
    ? new AnthropicProvider(createMockClient(), model, configuredEffort())
    : providerName === "gemini"
      ? new GeminiProvider(process.env.GEMINI_API_KEY, model, fetch, undefined, fallbacks)
      : new AnthropicProvider(new Anthropic(), model, configuredEffort());
  const today = new Date().toISOString().slice(0, 10);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // The traveller can navigate away mid-turn; writing to a closed
      // controller throws, and that must not lose the usage record.
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          open = false;
        }
      };

      try {
        const result = await runBentoMan({
          store, provider, today, message, spend,
          events: {
            onText: (delta) => send({ type: "text", delta }),
            onTool: (name, phase, ok) => send({ type: "tool", name, phase, ok }),
          },
        });
        send({ type: "done", messageId: result.assistantMessageId, text: result.text, proposal: result.proposal });
      } catch (e) {
        // A turn that died after a model call still spent money (E2).
        send({ type: "error", message: friendly(e, keyVariable) });
      } finally {
        // Each model call settled its own hold. If no call ever started,
        // the first hold is still ours to give back.
        await first?.settle(null);
        open = false;
        try {
          controller.close();
        } catch {
          // already closed by the client going away
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

function friendly(e: unknown, keyVariable: string): string {
  if (e instanceof ProviderCallError) {
    if (e.timedOut) return copy.server.tooSlow;
    if (e.status === 401 || e.status === 403) {
      console.error(`Bento Man's key was rejected: check ${keyVariable}.`);
      return copy.server.keyRejected;
    }
    // By now every fallback model is out too, which on a free tier can mean
    // the daily quota: "a minute" would be a promise we can't keep.
    if (e.status === 429) return copy.server.outOfRequests;
    if (e.status && e.status >= 500) return copy.server.overloaded;
    if (e.status) return copy.server.failedWith(e.status);
  }
  // AbortSignal.timeout on a model call that never finished.
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return copy.server.tooSlow;
  }
  if (e instanceof Anthropic.AuthenticationError) {
    console.error("Bento Man's key was rejected: check ANTHROPIC_API_KEY.");
    return copy.server.keyRejected;
  }
  if (e instanceof Anthropic.RateLimitError) return copy.server.busy;
  if (e instanceof Anthropic.APIError) return copy.server.failedWith(e.status);
  if (e instanceof Error && e.message === "trip not found") return copy.server.notYourTrip;
  return copy.server.failed;
}
