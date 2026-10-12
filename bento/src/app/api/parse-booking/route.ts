import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/guards/rate-limit";
import { reserveSpend, SpendCapExceeded } from "@/lib/guards/spend";
import { costUsd, type Usage } from "@/lib/bento-man/cost";
import { createMockClient, mockModeEnabled } from "@/lib/bento-man/mock";
import { PARSE_MODEL, ParseFailed, parseConfirmation, toFormValues } from "@/lib/vault/parse";

/** POST /api/parse-booking — read a pasted confirmation into form fields.
 *
 *  The model call has no tools and no trip state, so a malicious paste has
 *  nothing to steer (§15). Nothing is written: the traveller reviews every
 *  field and presses Save themselves. */
const Body = z.object({ text: z.string().min(8).max(12_000) });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste the confirmation text first." }, { status: 400 });

  const limit = await rateLimit(db, "parse");
  if (!limit.allowed) {
    return NextResponse.json({ error: "That's a lot of confirmations at once. Try again in a moment." }, { status: 429 });
  }

  const mock = mockModeEnabled();
  if (!mock && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Reading confirmations isn't configured on this server. Fill the form in by hand." }, { status: 503 });
  }

  let reservation;
  try {
    reservation = await reserveSpend(user.id, "parse");
  } catch (e) {
    if (e instanceof SpendCapExceeded) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }

  // Every billed call is recorded, read or not: a reply that fails the
  // schema cost the same as one that passes, and an unrecorded failure is
  // a way past the spend cap (E2).
  const record = (model: string, usage: Usage) =>
    reservation.settle({
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cacheReadTokens,
      costUsd: costUsd(PARSE_MODEL, usage),
    });

  try {
    const result = await parseConfirmation(mock ? createMockClient() : new Anthropic(), parsed.data.text);
    await record(result.model, result.usage);
    return NextResponse.json({ values: toFormValues(result.booking) });
  } catch (e) {
    if (e instanceof ParseFailed) {
      if (e.usage) await record(e.model ?? PARSE_MODEL, e.usage);
      else await reservation.settle(null);
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    await reservation.settle(null);
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: "Couldn't read that one. Fill the form in by hand." }, { status: 502 });
    return NextResponse.json({ error: "Something went wrong reading that. Fill the form in by hand." }, { status: 500 });
  }
}
