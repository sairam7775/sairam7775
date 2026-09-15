/** The trip store with no database: the drafted corridor treated as
 *  verified, the hand-seeded graph, and state in memory. What the eval set
 *  and the tests run against. Never used by the product. */
import type { PlaceInput } from "@/lib/engine/types";
import { CITY_HUBS, type CityFacts } from "@/lib/engine/route";
import { buildGraph, type Graph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { kyoto } from "@/lib/places/seed/kyoto";
import { osaka } from "@/lib/places/seed/osaka";
import { nara } from "@/lib/places/seed/nara";
import { hiroshima } from "@/lib/places/seed/hiroshima";
import { miyajima } from "@/lib/places/seed/miyajima";
import { himeji } from "@/lib/places/seed/himeji";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import type { CoverageTier } from "@/lib/types";
import type { Proposal } from "./diff";
import { allocateDates } from "@/lib/engine/route";
import { DEFAULT_PREFS, type ChatTurn, type DayRow, type Prefs, type TripCityRow, type TripMeta, type TripState, type TripStore } from "./store";

const CORRIDOR: { id: string; name: string; tier: CoverageTier }[] = [
  { id: "kyoto-city", name: "Kyoto", tier: "deep" },
  { id: "osaka-city", name: "Osaka", tier: "deep" },
  { id: "nara-city", name: "Nara", tier: "deep" },
  { id: "hiroshima-city", name: "Hiroshima", tier: "deep" },
  { id: "miyajima", name: "Miyajima", tier: "outline" },
  { id: "himeji", name: "Himeji", tier: "outline" },
];

/** Cities Bento lists but does not know — so "plan my days in Takayama"
 *  has something honest to bounce off. */
const STUBS: { id: string; name: string }[] = [
  { id: "tokyo-city", name: "Tokyo" },
  { id: "takayama", name: "Takayama" },
  { id: "kanazawa", name: "Kanazawa" },
  { id: "hakone", name: "Hakone" },
  { id: "nikko", name: "Nikko" },
  { id: "kobe", name: "Kobe" },
];

const SEEDS = { "kyoto-city": kyoto, "osaka-city": osaka, "nara-city": nara, "hiroshima-city": hiroshima, miyajima, himeji } as const;

export interface MemorySetup {
  trip?: Partial<TripMeta>;
  prefs?: Partial<Prefs>;
  cities?: { cityId: string; nights: number; reason?: string; budgetBand?: TripCityRow["budgetBand"] }[];
  days?: DayRow[];
  /** Override a city's tier — e.g. make Kyoto a stub to test the refusal. */
  tiers?: Record<string, CoverageTier>;
  history?: ChatTurn[];
}

export class MemoryStore implements TripStore {
  trip: TripMeta;
  prefs: Prefs;
  tripCities: TripCityRow[] = [];
  days: DayRow[] = [];
  messages: (ChatTurn & { id: string; proposal: Proposal | null; status: "proposed" | "accepted" | "rejected" | null })[] = [];
  readonly tiers: Record<string, CoverageTier>;
  private g: Graph | null = null;
  private placeCache = new Map<string, PlaceInput[]>();
  private seq = 0;

  constructor(setup: MemorySetup = {}) {
    this.trip = { id: "trip-mem", title: "Test trip", startDate: null, endDate: null, partySize: 1, status: "planning", ...setup.trip };
    this.prefs = { ...DEFAULT_PREFS, ...setup.prefs, set: setup.prefs ? (setup.prefs.set ?? true) : false };
    this.tiers = { ...Object.fromEntries(CORRIDOR.map((c) => [c.id, c.tier])), ...setup.tiers };
    if (setup.cities) this.setRoute(setup.cities.map((c) => ({ cityId: c.cityId, nights: c.nights, reason: c.reason ?? null, budgetBand: c.budgetBand ?? null })));
    this.days = setup.days ? setup.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i })) })) : [];
    for (const h of setup.history ?? []) this.messages.push({ ...h, id: `m${++this.seq}`, proposal: null, status: null });
  }

  private cityName(id: string) {
    return CORRIDOR.find((c) => c.id === id)?.name ?? STUBS.find((c) => c.id === id)?.name ?? id;
  }

  private setRoute(list: { cityId: string; nights: number; reason: string | null; budgetBand: TripCityRow["budgetBand"] }[]) {
    const dated = allocateDates(this.trip.startDate, list, this.trip.endDate);
    this.tripCities = list.map((c, i) => ({
      cityId: c.cityId,
      name: this.cityName(c.cityId),
      tier: this.tiers[c.cityId] ?? "stub",
      nights: c.nights,
      sortOrder: i,
      budgetBand: c.budgetBand,
      reason: c.reason,
      arriveDate: dated[i].arriveDate,
      departDate: dated[i].departDate,
    }));
  }

  async state(): Promise<TripState> {
    const pending = [...this.messages].reverse().find((m) => m.status === "proposed");
    return {
      trip: { ...this.trip },
      prefs: { ...this.prefs },
      cities: this.tripCities.map((c) => ({ ...c })),
      days: this.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i })) })).sort((a, b) => a.date.localeCompare(b.date)),
      pendingProposal: pending ? { id: pending.id, summary: pending.proposal!.summary } : null,
    };
  }

  async savePreferences(p: Partial<Omit<Prefs, "set">>): Promise<Prefs> {
    const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
    this.prefs = { ...this.prefs, ...clean, set: true };
    return { ...this.prefs };
  }

  async setTripDates(p: { startDate?: string | null; endDate?: string | null; partySize?: number; title?: string | null }): Promise<TripMeta> {
    if (p.startDate !== undefined) this.trip.startDate = p.startDate;
    if (p.endDate !== undefined) this.trip.endDate = p.endDate;
    if (p.partySize !== undefined) this.trip.partySize = p.partySize;
    if (p.title !== undefined) this.trip.title = p.title;
    if (this.tripCities.length) this.setRoute(this.tripCities.map((c) => ({ cityId: c.cityId, nights: c.nights, reason: c.reason, budgetBand: c.budgetBand })));
    return { ...this.trip };
  }

  async cities(): Promise<CityFacts[]> {
    const corridor = CORRIDOR.map((c) => ({
      id: c.id,
      name: c.name,
      tier: this.tiers[c.id] ?? c.tier,
      verifiedPlaces: (this.tiers[c.id] ?? c.tier) === "stub" ? 0 : SEEDS[c.id as keyof typeof SEEDS].length,
      transitNote: null,
      hubStation: CITY_HUBS[c.id] ?? null,
    }));
    const stubs = STUBS.map((c) => ({ id: c.id, name: c.name, tier: (this.tiers[c.id] ?? "stub") as CoverageTier, verifiedPlaces: 0, transitNote: null, hubStation: null }));
    return [...corridor, ...stubs];
  }

  async places(cityId: string): Promise<PlaceInput[]> {
    if (!this.placeCache.has(cityId)) {
      const seeds = SEEDS[cityId as keyof typeof SEEDS] ?? [];
      const tier = this.tiers[cityId] ?? "stub";
      this.placeCache.set(cityId, seeds.map((s) => seedToPlaceInput(s, { tier, status: "verified" })));
    }
    return this.placeCache.get(cityId)!;
  }

  async searchPlaces(query: string, cityId?: string | null): Promise<PlaceInput[]> {
    const q = query.toLowerCase().trim();
    const ids = cityId ? [cityId] : Object.keys(SEEDS);
    const out: PlaceInput[] = [];
    for (const id of ids) for (const p of await this.places(id)) {
      if (p.id === q || p.name.toLowerCase().includes(q) || p.id.includes(q.replace(/\s+/g, "-"))) out.push(p);
    }
    return out.sort((a, b) => (a.id === q ? -1 : b.id === q ? 1 : b.signature - a.signature)).slice(0, 8);
  }

  async graph(): Promise<Graph> {
    if (!this.g) this.g = buildGraph(stations, edges);
    return this.g;
  }

  async history(limit: number): Promise<ChatTurn[]> {
    return this.messages.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
  }

  async append(role: "user" | "assistant", content: string, proposal?: Proposal | null): Promise<{ id: string }> {
    const id = `m${++this.seq}`;
    this.messages.push({ id, role, content, proposal: proposal ?? null, status: proposal ? "proposed" : null });
    return { id };
  }

  async applyProposal(p: Proposal): Promise<void> {
    if (p.route) this.setRoute(p.route.after.map((c) => ({ cityId: c.cityId, nights: c.nights, reason: c.reason, budgetBand: c.budgetBand })));
    for (const d of p.days) {
      const items = d.after.map((it, i) => ({
        placeId: it.placeId,
        name: it.name,
        sortOrder: i,
        startMin: it.startMin,
        durationMin: it.durationMin,
        locked: it.locked,
        reason: it.reason,
        reasonTerms: it.reasonTerms,
        arriveMode: it.arriveMode,
        arriveMinutes: it.arriveMinutes,
        arriveDetail: it.arriveDetail,
      }));
      const existing = this.days.find((x) => x.date === d.date);
      if (existing) {
        existing.cityId = d.cityId;
        existing.items = items;
      } else this.days.push({ date: d.date, cityId: d.cityId, items });
    }
    for (const m of this.messages) if (m.status === "proposed") m.status = "accepted";
  }
}
