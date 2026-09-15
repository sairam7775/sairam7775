import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, CHAT_LIMIT } from "@/lib/guards/rate-limit";
import { assertWithinSpendCap, recordUsage, SpendCapExceeded } from "@/lib/guards/spend";
import { runBentoMan } from "@/lib/bento-man/chat";
import { configuredEffort, configuredModel, costUsd } from "@/lib/bento-man/cost";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";

/** POST /api/chat — one turn with Bento Man, streamed as server-sent events.
 *
 *  Order of the guards matters: auth, then the per-user throttle, then the
 *  spend cap, and only then a model call. Usage is recorded after the turn
 *  whatever happened to it, so a failed turn still counts what it cost. */
const Body = z.object({
  tripId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Say something, up to 2000 characters." }, { status: 400 });
  const { tripId, message } = parsed.data;

  const limit = rateLimit(`chat:${user.id}`, CHAT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Slow down a little — try again in a moment." }, { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } });
  }

  try {
    await assertWithinSpendCap(user.id);
  } catch (e) {
    if (e instanceof SpendCapExceeded) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Bento Man isn't configured on this server yet (ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  const store = new SupabaseStore(db, tripId, user.id);
  const client = new Anthropic();
  const model = configuredModel();
  const effort = configuredEffort();
  const today = new Date().toISOString().slice(0, 10);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await runBentoMan({
          store, client, model, effort, today, message,
          events: {
            onText: (delta) => send({ type: "text", delta }),
            onTool: (name, phase, ok) => send({ type: "tool", name, phase, ok }),
          },
        });
        await recordUsage({
          userId: user.id,
          kind: "chat",
          model: result.servedBy,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cachedTokens: result.usage.cacheReadTokens,
          costUsd: costUsd(result.servedBy, result.usage),
        });
        send({ type: "done", messageId: result.assistantMessageId, text: result.text, proposal: result.proposal });
      } catch (e) {
        send({ type: "error", message: friendly(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

function friendly(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Bento Man's API key was rejected. Check ANTHROPIC_API_KEY on the server.";
  if (e instanceof Anthropic.RateLimitError) return "Bento Man is busy — try again in a minute.";
  if (e instanceof Anthropic.APIError) return `Bento Man hit an error (${e.status}). Try again.`;
  if (e instanceof Error && e.message === "trip not found") return "That trip isn't yours, or doesn't exist.";
  return "Something went wrong on the way to Bento Man. Try again.";
}
