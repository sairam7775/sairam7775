import { NextResponse } from "next/server";
import { postHogDeleter } from "@/lib/account/delete";
import { createAdminClient } from "@/lib/supabase/admin";

type Counts = { done: number; failed: number; given_up: number };
type QueuedDeletion = { user_id: string; attempts: number };

const emptyCounts = (): Counts => ({ done: 0, failed: 0, given_up: 0 });

export const maxDuration = 60;

// Fewest tries first, so a batch that keeps failing can't hold back rows
// that haven't had a try yet. The time budget leaves room to answer before
// maxDuration; any row not reached goes first next run.
const BATCH = 200;
const TIME_BUDGET_MS = 45_000;

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

/** Daily service-role retry for PostHog deletions left by account removal. */
export async function GET(request: Request) {
  const counts = emptyCounts();
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json(counts, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(counts, { status: 401 });
  }

  const deleteAnalytics = postHogDeleter();
  if (!deleteAnalytics) return NextResponse.json(counts);

  const started = Date.now();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("analytics_deletions")
      .select("user_id, attempts")
      .lt("attempts", 10)
      .order("attempts", { ascending: true })
      .order("queued_at", { ascending: true })
      .limit(BATCH);

    if (error) throw new Error(`analytics_deletions read: ${error.message}`);

    for (const row of (data ?? []) as QueuedDeletion[]) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        console.error("Analytics deletion retries ran out of time; the rest wait for the next run.");
        break;
      }
      try {
        await deleteAnalytics(row.user_id);
      } catch (error) {
        const attempts = row.attempts + 1;
        const { error: updateError } = await admin
          .from("analytics_deletions")
          .update({ attempts, last_error: errorMessage(error) })
          .eq("user_id", row.user_id);

        if (updateError) {
          counts.failed += 1;
          console.error("Could not update a queued analytics deletion.");
          continue;
        }

        if (attempts >= 10) {
          counts.given_up += 1;
          console.error("Analytics deletion reached 10 attempts; manual follow-up is needed.");
        } else {
          counts.failed += 1;
        }
        continue;
      }

      const { error: deleteError } = await admin
        .from("analytics_deletions")
        .delete()
        .eq("user_id", row.user_id);
      if (deleteError) {
        counts.failed += 1;
        console.error("Could not remove a completed analytics deletion from the queue.");
      } else {
        counts.done += 1;
      }
    }

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Analytics deletion retry job failed.", error instanceof Error ? error.message : error);
    return NextResponse.json(counts, { status: 500 });
  }
}
