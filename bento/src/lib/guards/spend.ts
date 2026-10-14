import { createAdminClient } from "@/lib/supabase/admin";

/** Risk E2 — an uncapped model bill on a personal card is the fastest way
 *  this project hurts its owner, and it is trivially preventable.
 *
 *  Every model call records what it cost; every call checks the month's
 *  total first. The check happens server-side against a service-role read,
 *  so a client cannot talk its way past it. */

const DEFAULT_CAP_USD = 20;

export function monthlyCapUsd(): number {
  const raw = process.env.BENTO_MONTHLY_SPEND_CAP_USD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CAP_USD;
}

export interface SpendStatus {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  exceeded: boolean;
}

export async function getSpendStatus(userId: string): Promise<SpendStatus> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("month_to_date_spend", { p_user: userId });
  if (error) throw error;

  const spentUsd = Number(data ?? 0);
  const capUsd = monthlyCapUsd();

  return {
    spentUsd,
    capUsd,
    remainingUsd: Math.max(0, capUsd - spentUsd),
    exceeded: spentUsd >= capUsd,
  };
}

/** Call before any model request. Throws rather than returning a flag, so
 *  a forgotten check cannot silently spend money. */
export async function assertWithinSpendCap(userId: string): Promise<SpendStatus> {
  const status = await getSpendStatus(userId);
  if (status.exceeded) {
    throw new SpendCapExceeded(status);
  }
  return status;
}

export class SpendCapExceeded extends Error {
  constructor(readonly status: SpendStatus) {
    super(
      `Monthly spend cap reached: $${status.spentUsd.toFixed(2)} of ` +
        `$${status.capUsd.toFixed(2)}. Planning still works — only Bento Man is paused.`,
    );
    this.name = "SpendCapExceeded";
  }
}

export interface UsageRecord {
  userId: string;
  kind: "chat" | "parse" | "draft";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd: number;
}

export async function recordUsage(usage: UsageRecord): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("api_usage").insert({
    user_id: usage.userId,
    kind: usage.kind,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_tokens: usage.cachedTokens ?? 0,
    cost_usd: usage.costUsd,
  });
  if (error) throw error;
}
