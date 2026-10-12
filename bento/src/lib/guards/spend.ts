import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Risk E2 — an uncapped model bill on a personal card is the fastest way
 *  this project hurts its owner, and it is trivially preventable.
 *
 *  Two caps, both enforced server-side with a service-role client so a
 *  caller cannot talk its way past them: one per user, and one for the
 *  whole project (the owner's card is what is actually on the line).
 *
 *  A call RESERVES an estimate before it runs (`reserve_spend`, 0014), in
 *  a transaction that serialises every reservation, so parallel requests
 *  see each other's holds instead of all reading the same total. When the
 *  call ends, `settle()` swaps the estimate for the real cost. */

const DEFAULT_CAP_USD = 20;
const DEFAULT_GLOBAL_CAP_USD = 50;

function positiveEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per user, per calendar month. */
export function monthlyCapUsd(): number {
  return positiveEnv("BENTO_MONTHLY_SPEND_CAP_USD", DEFAULT_CAP_USD);
}

/** Everyone together, per calendar month. */
export function globalMonthlyCapUsd(): number {
  return positiveEnv("BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD", DEFAULT_GLOBAL_CAP_USD);
}

/** What a call is assumed to cost until it reports its real usage. Set
 *  above a typical call, so the cap is held a little early rather than
 *  overshot. */
export const ESTIMATE_USD = { chat: 0.5, parse: 0.05 } as const;

export type SpendKind = keyof typeof ESTIMATE_USD;

export interface SpendStatus {
  spentUsd: number;
  capUsd: number;
}

export class SpendCapExceeded extends Error {
  constructor(readonly scope: "user" | "global", readonly status: SpendStatus) {
    super(
      scope === "user"
        ? `Monthly spend cap reached: $${status.spentUsd.toFixed(2)} of ` +
            `$${status.capUsd.toFixed(2)}. Planning still works — only Bento Man is paused.`
        : "Bento Man is resting for the rest of the month — the shared budget is used up. Planning still works.",
    );
    this.name = "SpendCapExceeded";
  }
}

export interface Settlement {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd: number;
}

/** A hold on the cap for one in-flight call. Settle it exactly once; a
 *  second call does nothing. A call that never reached the model settles
 *  with zero tokens and leaves no trace. */
export class SpendReservation {
  private done = false;

  constructor(private readonly id: number, private readonly admin: SupabaseClient) {}

  async settle(usage: Settlement | null): Promise<void> {
    if (this.done) return;
    this.done = true;
    const { error } = await this.admin.rpc("settle_spend", {
      p_id: this.id,
      p_model: usage?.model ?? "none",
      p_input_tokens: usage?.inputTokens ?? 0,
      p_output_tokens: usage?.outputTokens ?? 0,
      p_cached_tokens: usage?.cachedTokens ?? 0,
      p_cost: usage?.costUsd ?? 0,
    });
    // Unsettled, the estimate stays on the books until it ages out: the
    // safe direction to fail in. Never let it break the response.
    if (error) console.error("settle_spend failed", error.message);
  }
}

/** Call before any model request. Throws `SpendCapExceeded` rather than
 *  returning a flag, so a forgotten check cannot silently spend money. */
export async function reserveSpend(
  userId: string,
  kind: SpendKind,
  admin: SupabaseClient = createAdminClient(),
): Promise<SpendReservation> {
  const { data, error } = await admin.rpc("reserve_spend", {
    p_user: userId,
    p_kind: kind,
    p_estimate: ESTIMATE_USD[kind],
    p_user_cap: monthlyCapUsd(),
    p_global_cap: globalMonthlyCapUsd(),
  });
  // Fail closed, like the rate limiter.
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { reservation_id: number | null; refused: "user" | "global" | null; user_spent: number | string; global_spent: number | string }
    | undefined;
  if (!row) throw new Error("reserve_spend returned no row");

  if (row.refused === "user") throw new SpendCapExceeded("user", { spentUsd: Number(row.user_spent), capUsd: monthlyCapUsd() });
  if (row.refused === "global") throw new SpendCapExceeded("global", { spentUsd: Number(row.global_spent), capUsd: globalMonthlyCapUsd() });
  if (row.reservation_id == null) throw new Error("reserve_spend neither reserved nor refused");

  return new SpendReservation(row.reservation_id, admin);
}
