import type { createClient } from "@/lib/supabase/server";
import type { TripState, TripStore } from "@/lib/bento-man/store";
import { loadChat } from "./load-chat";

type Db = Awaited<ReturnType<typeof createClient>>;

/** The trip page's first round of reads, all at once: everything here needs
 *  only the trip's id. The chat takes the route's city names when the trip
 *  read has them. Null when the trip can't be read, whatever the other reads
 *  did, so the page is a 404; a chat failure is thrown only after that. */
export async function readTrip(db: Db, store: Pick<TripStore, "state">, tripId: string) {
  const statePromise: Promise<TripState | null> = store.state().catch(() => null);
  const chatRead = loadChat(db, tripId, statePromise.then((s) => (s?.cities ?? []).map((c) => ({ id: c.cityId, name: c.name }))))
    .then((value) => ({ value }), (error: unknown) => ({ error }));
  const [state, chat, { data: bookingRows }, { data: reviewRow }, { data: share }, { data: dismissals }] = await Promise.all([
    statePromise,
    chatRead,
    // For the Bookings column and the gap check, in the order the vault
    // reads them. Never the reference: it is decrypted only on the vault page.
    db.from("bookings")
      .select("id, type, title, starts_at, ends_at, starts_time_known, ends_time_known, planned_on, city_id, to_city_id, place_id")
      .eq("trip_id", tripId)
      .order("starts_at", { nullsFirst: false }),
    // "How did the plan hold up?" once the trip has ended (0019).
    db.from("trip_reviews").select("outcome, challenges, hard_days, note, plan").eq("trip_id", tripId).maybeSingle(),
    // The companions' link, if the trip is shared (0020/0024).
    db.from("trip_shares").select("token, expires_at, until_trip_end").eq("trip_id", tripId).maybeSingle(),
    db.from("gap_dismissals").select("gap_key").eq("trip_id", tripId),
  ]);
  if (!state) return null;
  if ("error" in chat) throw chat.error;
  return { state, chat: chat.value, bookingRows, reviewRow, share, dismissals };
}
