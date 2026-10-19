/** The trip store over Supabase, as the signed-in user. Every read and
 *  write goes through RLS; places arrive through places_public, so a draft
 *  is as invisible to Bento Man as it is to the traveller. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceInput } from "@/lib/engine/types";
import { rowToPlace } from "@/lib/engine/load";
import { CITY_HUBS, allocateDates, type CityFacts } from "@/lib/engine/route";
import { loadGraph } from "@/lib/transit/load";
import type { Graph } from "@/lib/transit/graph";
import type { CoverageTier } from "@/lib/types";
import { clock, ProposalSchema, type DatesDiff, type Proposal } from "./diff";
import { shiftConflicts, shiftRefusal } from "./shift";
import { DEFAULT_PREFS, planDateChange, type ChatTurn, type DayRow, type Prefs, type PrefsPatch, type TripMeta, type TripPatch, type TripState, type TripStore } from "./store";
import type { TicketLike } from "@/lib/vault/match";
import { copy } from "@/copy";

const toMin = (t: string | null): number | null => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** Why a route cannot be laid on the trip's dates, or null if it can. */
/** The route as replace_trip_route takes it, laid on `trip`'s dates, or
 *  null. Refused when the route doesn't fit those dates. */
function routeRows(p: Proposal, trip: { startDate: string | null; endDate: string | null }): unknown {
  if (!p.route) return null;
  const misfit = routeMisfit(trip, p.route.after);
  if (misfit) throw new Error(misfit);
  const dated = allocateDates(trip.startDate, p.route.after, trip.endDate);
  return p.route.after.map((c, i) => ({
    city_id: c.cityId,
    nights: c.nights,
    sort_order: i,
    budget_band: c.budgetBand ?? "",
    reason: c.reason ?? "",
    arrive_date: dated[i].arriveDate ?? "",
    depart_date: dated[i].departDate ?? "",
  }));
}

function dayRows(p: Proposal) {
  return p.days.map((d) => ({
    date: d.date,
    city_id: d.cityId ?? "",
    items: d.after.map((it, i) => dayItemRow({
      placeId: it.placeId, startMin: it.startMin, durationMin: it.durationMin, locked: it.locked, reason: it.reason,
      reasonTerms: it.reasonTerms, arriveMode: it.arriveMode, arriveMinutes: it.arriveMinutes, arriveDetail: it.arriveDetail,
    }, i)),
  }));
}

function routeMisfit(trip: { startDate: string | null; endDate: string | null }, cities: { nights: number }[]): string | null {
  if (!trip.startDate || !trip.endDate) return null;
  const tripNights = Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86_400_000);
  const routeNights = cities.reduce((s, c) => s + c.nights, 0);
  return routeNights > tripNights
    ? copy.plan.dates.routeLonger(routeNights, tripNights)
    : null;
}

export class SupabaseStore implements TripStore {
  // Each request owns its store. Share in-flight reads too; trip writes
  // discard state so a later tool sees the accepted change.
  private stateCache: Promise<TripState> | null = null;
  private citiesCache: Promise<CityFacts[]> | null = null;
  private tierCache: Map<string, CoverageTier> | null = null;

  constructor(
    private readonly db: SupabaseClient,
    readonly tripId: string,
    readonly userId: string,
  ) {}

  state(): Promise<TripState> {
    return this.stateCache ??= this.loadState().catch((error) => {
      this.stateCache = null;
      throw error;
    });
  }

  private async loadState(): Promise<TripState> {
    const [trip, prefs, cities, days, pending] = await Promise.all([
      this.db.from("trips").select("id, title, start_date, end_date, party_size, status").eq("id", this.tripId).maybeSingle(),
      this.db.from("user_preferences").select("*").eq("user_id", this.userId).maybeSingle(),
      this.db.from("trip_cities").select("city_id, nights, sort_order, budget_band, reason, arrive_date, depart_date, cities(name, coverage_tier)").eq("trip_id", this.tripId).order("sort_order"),
      this.db.from("itinerary_days").select("id, date, city_id, itinerary_items(id, place_id, sort_order, start_time, duration_min, locked, reason, reason_terms, arrive_mode, arrive_minutes, arrive_detail)").eq("trip_id", this.tripId).order("date"),
      this.db.from("chat_messages").select("id, proposed_diff").eq("trip_id", this.tripId).eq("diff_status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("trip not found");
    if (prefs.error) throw prefs.error;
    if (cities.error) throw cities.error;
    if (days.error) throw days.error;

    // Item names come from the gate, not a join on places (no user grant).
    const placeIds = [...new Set((days.data ?? []).flatMap((d) => (d.itinerary_items ?? []).map((i) => i.place_id)).filter(Boolean))] as string[];
    const names = new Map<string, { name: string; nameJa: string | null }>();
    if (placeIds.length) {
      const { data } = await this.db.from("places_public").select("id, name, name_ja").in("id", placeIds);
      for (const p of data ?? []) names.set(p.id, { name: p.name, nameJa: p.name_ja ?? null });
    }

    const p = prefs.data;
    const dayRows: DayRow[] = (days.data ?? []).map((d) => ({
      id: d.id,
      date: d.date,
      cityId: d.city_id,
      items: [...(d.itinerary_items ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          id: i.id,
          placeId: i.place_id,
          name: names.get(i.place_id)?.name ?? i.place_id,
          mapName: names.get(i.place_id)?.name ?? null,
          nameJa: names.get(i.place_id)?.nameJa ?? null,
          sortOrder: i.sort_order,
          startMin: toMin(i.start_time),
          durationMin: i.duration_min,
          locked: i.locked,
          reason: i.reason,
          reasonTerms: i.reason_terms ?? [],
          arriveMode: i.arrive_mode,
          arriveMinutes: i.arrive_minutes,
          arriveDetail: i.arrive_detail,
        })),
    }));

    return {
      trip: { id: trip.data.id, title: trip.data.title, startDate: trip.data.start_date, endDate: trip.data.end_date, partySize: trip.data.party_size, status: trip.data.status },
      prefs: p
        ? {
            pace: p.pace,
            interestTags: p.interest_tags ?? [],
            energy: Number(p.energy),
            crowdTolerance: Number(p.crowd_tolerance),
            discovery: Number(p.discovery),
            excludes: p.excludes ?? [],
            mobility: p.mobility ?? [],
            dietary: p.dietary ?? [],
            displayCurrency: p.display_currency ?? "JPY",
            set: Boolean(p.onboarded),
            autoApplyDates: Boolean(p.apply_dates_without_asking),
          }
        : { ...DEFAULT_PREFS },
      cities: (cities.data ?? []).map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const city = c.cities as any;
        return {
          cityId: c.city_id,
          name: city?.name ?? c.city_id,
          tier: (city?.coverage_tier ?? "stub") as CoverageTier,
          nights: c.nights,
          sortOrder: c.sort_order,
          budgetBand: c.budget_band,
          reason: c.reason,
          arriveDate: c.arrive_date,
          departDate: c.depart_date,
        };
      }),
      days: dayRows,
      pendingProposal: pending.data?.proposed_diff ? { id: pending.data.id, summary: String((pending.data.proposed_diff as { summary?: string }).summary ?? "proposal") } : null,
    };
  }

  async savePreferences(p: PrefsPatch): Promise<Prefs> {
    const row: Record<string, unknown> = { user_id: this.userId, onboarded: true };
    if (p.pace !== undefined) row.pace = p.pace;
    if (p.interestTags !== undefined) row.interest_tags = p.interestTags;
    if (p.energy !== undefined) row.energy = p.energy;
    if (p.crowdTolerance !== undefined) row.crowd_tolerance = p.crowdTolerance;
    if (p.discovery !== undefined) row.discovery = p.discovery;
    if (p.excludes !== undefined) row.excludes = p.excludes;
    if (p.mobility !== undefined) row.mobility = p.mobility;
    if (p.dietary !== undefined) row.dietary = p.dietary;
    if (p.displayCurrency !== undefined) row.display_currency = p.displayCurrency;
    const { error } = await this.db.from("user_preferences").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
    this.stateCache = null;
    return (await this.state()).prefs;
  }

  async setAutoApplyDates(on: boolean): Promise<void> {
    const { error } = await this.db.from("user_preferences").upsert({ user_id: this.userId, apply_dates_without_asking: on }, { onConflict: "user_id" });
    if (error) throw error;
    this.stateCache = null;
  }

  async setTripDates(p: TripPatch): Promise<TripMeta> {
    const before = await this.state();
    const prepared = await this.prepareDates(before, p);
    if (!prepared) return before.trip;

    // One transaction: the dates, the days' shift, the closed proposals and
    // the re-laid route all land together or not at all.
    const { error } = await this.db.rpc("update_trip_dates", {
      p_trip: this.tripId,
      p_patch: prepared.patch,
      p_shift: prepared.shift,
      p_cities: prepared.cities,
      p_reject: prepared.reject,
    });
    if (error) throw error;
    this.stateCache = null;
    return (await this.state()).trip;
  }

  async previewTripDates(p: TripPatch, route?: { nights: number }[]): Promise<TripMeta> {
    const before = await this.state();
    await this.prepareDates(before, p, { route });
    const change = planDateChange(before.trip, p, route ?? before.cities);
    return {
      ...before.trip,
      ...(change.changed ? { startDate: change.startDate, endDate: change.endDate } : {}),
      ...(p.partySize !== undefined ? { partySize: p.partySize } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
    };
  }

  /** Everything update_trip_dates needs, decided before anything is
   *  written, or null when nothing would change. Throws the refusal the
   *  traveller sees. `route` checks the range against a route proposed
   *  alongside; `keep` is a proposal being accepted, never closed here. */
  private async prepareDates(before: TripState, p: TripPatch, opts: { route?: { nights: number }[]; keep?: string } = {}) {
    // Decide before writing: a range too short for the route is refused
    // outright, and a "change" to the same dates is no change.
    const change = planDateChange(before.trip, p, opts.route ?? before.cities, before.days.filter((d) => d.items.length).map((d) => d.date));
    if (change.error) throw new Error(change.error);

    // Planned days move with the start, but a stop's opening days and the
    // traveller's tickets don't: refuse a move that would break them.
    const planned = before.days.filter((d) => d.items.length);
    if (change.changed && change.shift && planned.length) {
      const cityIds = [...new Set(planned.map((d) => d.cityId).filter((c): c is string => Boolean(c)))];
      const [lists, bookings] = await Promise.all([Promise.all(cityIds.map((c) => this.places(c))), this.bookings()]);
      const conflicts = shiftConflicts(planned, new Map(lists.flat().map((x) => [x.id, x])), bookings, change.shift);
      if (conflicts.length) throw new Error(shiftRefusal(conflicts));
    }

    const patch: Record<string, unknown> = {};
    if (change.changed) {
      patch.start_date = change.startDate;
      patch.end_date = change.endDate;
    }
    if (p.partySize !== undefined) patch.party_size = p.partySize;
    if (p.title !== undefined) patch.title = p.title;
    if (!Object.keys(patch).length) return null;

    let cities: unknown = null;
    let reject: string[] = [];
    if (change.changed) {
      // Dates moved: re-lay the accepted route on the calendar.
      if (before.cities.length) {
        const dated = allocateDates(change.startDate, before.cities, change.endDate);
        cities = before.cities.map((c, i) => ({ city_id: c.cityId, arrive_date: dated[i].arriveDate ?? "", depart_date: dated[i].departDate ?? "" }));
      }
      // A pending route survives a date change as long as it still fits.
      // Day plans are written against particular dates and cannot; close
      // those rather than let them be accepted into a contradiction.
      const { data: pending } = await this.db
        .from("chat_messages")
        .select("id, proposed_diff")
        .eq("trip_id", this.tripId)
        .eq("diff_status", "proposed");
      reject = (pending ?? [])
        .filter((m) => {
          const prop = ProposalSchema.safeParse(m.proposed_diff);
          return !prop.success || prop.data.days.length > 0 || (prop.data.route && routeMisfit({ startDate: change.startDate, endDate: change.endDate }, prop.data.route.after));
        })
        .map((m) => m.id)
        .filter((id) => id !== opts.keep);
    }
    return { patch, shift: change.changed ? change.shift : 0, cities, reject };
  }

  cities(): Promise<CityFacts[]> {
    return this.citiesCache ??= this.loadCities().catch((error) => {
      this.citiesCache = null;
      throw error;
    });
  }

  private async loadCities(): Promise<CityFacts[]> {
    const { data, error } = await this.db.from("city_coverage").select("city_id, name, coverage_tier, transit_note, verified_places");
    if (error) throw error;
    const graph = await this.graph();
    this.tierCache = new Map((data ?? []).map((c) => [c.city_id, c.coverage_tier as CoverageTier]));
    return (data ?? []).map((c) => {
      const hub = CITY_HUBS[c.city_id];
      let hubStation: string | null = hub && graph.stations.has(hub) ? hub : null;
      if (!hubStation) for (const s of graph.stations.values()) if (s.cityId === c.city_id) { hubStation = s.id; break; }
      return { id: c.city_id, name: c.name, tier: c.coverage_tier as CoverageTier, verifiedPlaces: Number(c.verified_places ?? 0), transitNote: c.transit_note ?? null, hubStation };
    });
  }

  private async tierOf(cityId: string): Promise<CoverageTier> {
    if (!this.tierCache) await this.cities();
    return this.tierCache!.get(cityId) ?? "stub";
  }

  async places(cityId: string): Promise<PlaceInput[]> {
    const [tier, { data, error }] = await Promise.all([this.tierOf(cityId), this.db.from("places_public").select("*").eq("city_id", cityId)]);
    if (error) throw error;
    return (data ?? []).map((r) => rowToPlace(r, tier));
  }

  async searchPlaces(query: string, cityId?: string | null): Promise<PlaceInput[]> {
    const q = query.trim();
    let sel = this.db.from("places_public").select("*").or(`id.eq.${q.toLowerCase().replace(/[^a-z0-9-]/g, "")},name.ilike.%${q.replace(/[%,()]/g, "")}%`).limit(8);
    if (cityId) sel = sel.eq("city_id", cityId);
    const { data, error } = await sel;
    if (error) throw error;
    const out: PlaceInput[] = [];
    for (const r of data ?? []) out.push(rowToPlace(r, await this.tierOf(r.city_id)));
    return out.sort((a, b) => (a.id === q ? -1 : b.id === q ? 1 : b.signature - a.signature));
  }

  async bookings(): Promise<TicketLike[]> {
    // RLS scopes bookings to the owner. The reference is not selected.
    const { data, error } = await this.db.from("bookings").select("type, title, starts_at, place_id").eq("trip_id", this.tripId);
    if (error) throw error;
    // starts_at is the wall time at the place stored as UTC, so its date
    // part is the local date (see vault/actions.ts stamp).
    return (data ?? []).map((b) => ({ type: b.type, title: b.title, startsOn: b.starts_at ? String(b.starts_at).slice(0, 10) : null, placeId: b.place_id }));
  }

  graph(): Promise<Graph> {
    return loadGraph();
  }

  async history(limit: number): Promise<ChatTurn[]> {
    const { data, error } = await this.db.from("chat_messages").select("role, content").eq("trip_id", this.tripId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  async append(role: "user" | "assistant", content: string, proposal?: Proposal | null): Promise<{ id: string }> {
    if (proposal) ProposalSchema.parse(proposal);
    const { data, error } = await this.db
      .from("chat_messages")
      .insert({ trip_id: this.tripId, role, content, proposed_diff: proposal ?? null, diff_status: proposal ? "proposed" : null })
      .select("id")
      .single();
    if (error) throw error;
    if (proposal) this.stateCache = null;
    return { id: data.id };
  }

  async applyProposal(p: Proposal, messageId?: string): Promise<void> {
    if (!messageId) throw new Error("applyProposal needs the stored proposal's id");
    if (p.dates) return this.applyWithDates(p, p.dates, messageId);
    // The dates on a route proposal are for showing; the route is laid on
    // the calendar as the trip stands now, which may have moved since.
    let meta: { startDate: string | null; endDate: string | null } = { startDate: null, endDate: null };
    if (p.route) {
      const { data: trip, error: tripError } = await this.db.from("trips").select("start_date, end_date").eq("id", this.tripId).single();
      if (tripError) throw tripError;
      meta = { startDate: trip.start_date as string | null, endDate: trip.end_date as string | null };
    }

    // One transaction: claiming the proposal, the route (and the days it
    // orphans), every day, and closing the older proposals. A failure
    // anywhere leaves the trip, and the proposal, exactly as they were.
    const { error } = await this.db.rpc("apply_proposal", {
      p_trip: this.tripId,
      p_message: messageId,
      p_route: routeRows(p, meta),
      p_days: dayRows(p),
      p_expect_start: meta.startDate,
      p_expect_end: meta.endDate,
    });
    if (error) throw error;
    this.stateCache = null;
  }

  /** A proposal that moves the dates: the date change (as setTripDates
   *  would make it), then the route laid on the NEW dates and the days, in
   *  one transaction (0016). Refused if the trip has moved since. */
  private async applyWithDates(p: Proposal, d: DatesDiff, messageId: string): Promise<void> {
    this.stateCache = null;
    const before = await this.state();
    if (before.trip.startDate !== d.before.startDate || before.trip.endDate !== d.before.endDate) {
      throw new Error(copy.plan.dates.changedWhileOpen);
    }
    const prepared = await this.prepareDates(
      before,
      { startDate: d.after.startDate, endDate: d.after.endDate, partySize: d.after.partySize, title: d.after.title },
      { route: p.route?.after, keep: messageId },
    );
    const { error } = await this.db.rpc("apply_proposal_with_dates", {
      p_trip: this.tripId,
      p_message: messageId,
      p_expect_start: before.trip.startDate,
      p_expect_end: before.trip.endDate,
      p_patch: prepared?.patch ?? {},
      p_shift: prepared?.shift ?? 0,
      p_cities: prepared?.cities ?? null,
      p_reject: prepared?.reject ?? [],
      p_route: routeRows(p, d.after),
      p_days: dayRows(p),
    });
    if (error) throw error;
    this.stateCache = null;
  }

  async saveDay(day: DayRow): Promise<void> {
    await this.writeDay(day.date, day.cityId, day.items);
  }

  private async writeDay(
    date: string,
    cityId: string | null,
    items: {
      placeId: string; startMin: number | null; durationMin: number | null; locked: boolean; reason: string | null;
      reasonTerms: string[]; arriveMode: string | null; arriveMinutes: number | null; arriveDetail: string | null;
    }[],
  ): Promise<void> {
    const { error } = await this.db.rpc("replace_day_items", {
      p_trip: this.tripId,
      p_date: date,
      p_city: cityId,
      p_items: items.map((it, i) => dayItemRow(it, i)),
    });
    if (error) throw error;
    this.stateCache = null;
  }
}

/** One stop as replace_day_items takes it (empty strings stand for null). */
function dayItemRow(
  it: {
    placeId: string; startMin: number | null; durationMin: number | null; locked: boolean; reason: string | null;
    reasonTerms: string[]; arriveMode: string | null; arriveMinutes: number | null; arriveDetail: string | null;
  },
  i: number,
) {
  return {
    place_id: it.placeId,
    sort_order: i,
    start_time: it.startMin == null ? "" : clock(it.startMin),
    duration_min: it.durationMin == null ? "" : String(it.durationMin),
    locked: it.locked,
    reason: it.reason ?? "",
    reason_terms: it.reasonTerms,
    arrive_mode: it.arriveMode ?? "",
    arrive_minutes: it.arriveMinutes == null ? "" : String(it.arriveMinutes),
    arrive_detail: it.arriveDetail ?? "",
  };
}
