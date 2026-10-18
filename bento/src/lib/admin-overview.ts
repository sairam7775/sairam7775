import type { SupabaseClient, User } from "@supabase/supabase-js";
import { configuredProvider, type ProviderName } from "@/lib/bento-man/provider";
import { configuredFallbacks, configuredModel } from "@/lib/bento-man/cost";
import { globalMonthlyCapUsd, monthlyCapUsd } from "@/lib/guards/spend";

/** What the admin section of Settings shows. Read with the service role,
 *  so only call it after checking the viewer is an admin. */
export interface AdminOverview {
  /** Places waiting for a human to check them. */
  toCheck: number;
  tripReviews: number;
  /** This calendar month, everyone together, as the spending cap counts it. */
  spentUsd: number;
  capUsd: number;
  perUserCapUsd: number;
  provider: ProviderName;
  model: string;
  fallbacks: string[];
  admins: { id: string; email: string; since: string }[];
}

export async function adminOverview(db: SupabaseClient): Promise<AdminOverview> {
  const [drafts, reviews, spend, roster] = await Promise.all([
    db.from("places").select("id", { count: "exact", head: true }).eq("verification_status", "draft"),
    db.from("trip_reviews").select("trip_id", { count: "exact", head: true }),
    // The same sum reserve_spend checks against (0014).
    db.rpc("spend_since_month_start", { p_user: null }),
    db.from("app_admins").select("user_id, created_at").order("created_at"),
  ]);
  const rows = (roster.data ?? []) as { user_id: string; created_at: string }[];
  const admins = await Promise.all(
    rows.map(async (r) => {
      const { data } = await db.auth.admin.getUserById(r.user_id);
      return { id: r.user_id, email: data.user?.email ?? r.user_id, since: r.created_at };
    }),
  );
  return {
    toCheck: drafts.count ?? 0,
    tripReviews: reviews.count ?? 0,
    spentUsd: Number(spend.data ?? 0),
    capUsd: globalMonthlyCapUsd(),
    perUserCapUsd: monthlyCapUsd(),
    provider: configuredProvider(),
    model: configuredModel(),
    fallbacks: configuredFallbacks(),
    admins,
  };
}

/** The account with this email address, if there is one. The admin API has
 *  no lookup by email, so this pages through the users; fine at Bento's size. */
export async function findUserByEmail(db: SupabaseClient, email: string): Promise<User | null> {
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === want);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}
