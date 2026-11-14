import type { createClient } from "@/lib/supabase/server";
import { parseProposal } from "@/lib/bento-man/diff";
import type { ChatMessage } from "./chat";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Bento Man's conversation for a trip, as the plan page and Bookings both
 *  show it: the last 60 messages, oldest first, and a name for every city
 *  they mention, so an old day proposal keeps its city after the route
 *  changes. `routeCities` are the trip's own, which always win. */
export async function loadChat(db: Db, tripId: string, routeCities: { id: string; name: string }[]) {
  const { data: rows } = await db
    .from("chat_messages")
    .select("id, role, content, proposed_diff, diff_status, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(60);
  const messages: ChatMessage[] = (rows ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    proposal: m.proposed_diff ? parseProposal(m.proposed_diff) : null,
    status: (m.diff_status as ChatMessage["status"]) ?? null,
  }));

  const proposalCityIds = [...new Set(messages.flatMap((m) => m.proposal?.days.map((d) => d.cityId) ?? []))];
  const { data: cityRows } = proposalCityIds.length
    ? await db.from("cities").select("id, name").in("id", proposalCityIds)
    : { data: [] as { id: string; name: string }[] };
  const cityNames: Record<string, string> = Object.fromEntries([
    ...(cityRows ?? []).map((c) => [c.id, c.name] as const),
    ...routeCities.map((c) => [c.id, c.name] as const),
  ]);
  return { messages, cityNames };
}
