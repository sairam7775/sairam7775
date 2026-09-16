import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, UPLOAD_LIMIT } from "@/lib/guards/rate-limit";
import { assertWithinSpendCap, recordUsage, SpendCapExceeded } from "@/lib/guards/spend";
import { costUsd } from "@/lib/bento-man/cost";
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

  const limit = rateLimit(`parse:${user.id}`, UPLOAD_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json({ error: "That's a lot of confirmations at once. Try again in a moment." }, { status: 429 });
  }

  try {
    await assertWithinSpendCap(user.id);
  } catch (e) {
    if (e instanceof SpendCapExceeded) return NextResponse.json({ error: e.message }, { status: 402 });
    throw e;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Reading confirmations isn't configured on this server. Fill the form in by hand." }, { status: 503 });
  }

  try {
    const result = await parseConfirmation(new Anthropic(), parsed.data.text);
    await recordUsage({
      userId: user.id,
      kind: "parse",
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cacheReadTokens,
      costUsd: costUsd(PARSE_MODEL, result.usage),
    }).catch(() => {});
    return NextResponse.json({ values: toFormValues(result.booking) });
  } catch (e) {
    if (e instanceof ParseFailed) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: "Couldn't read that one. Fill the form in by hand." }, { status: 502 });
    return NextResponse.json({ error: "Something went wrong reading that. Fill the form in by hand." }, { status: 500 });
  }
}
