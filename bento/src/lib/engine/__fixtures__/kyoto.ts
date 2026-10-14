/** Kyoto as the engine sees it — a dozen verified records at the Fig. 3
 *  shape, plus the traps the engine must not fall into. Stations map to
 *  the P3 corridor seed so the real router carries the legs; places with
 *  no station exercise the honest fallback.
 *
 *  Seed values, like everything in this repo that is not yet verified. */
import type { PlaceInput, TravellerInput } from "../types";

const base = {
  cityId: "kyoto-city",
  coverageTier: "deep" as const,
  verificationStatus: "verified" as const,
  worthItIf: [] as string[],
  pairsWith: [] as string[],
  closedDates: [] as string[],
  bookingLeadDays: null,
  physicalDemand: null,
};

export const kyoto: PlaceInput[] = [
  { ...base, id: "kyt-fushimi-inari", name: "Fushimi Inari Taisha", category: "shrine",
    interestTags: ["shrines", "nature"], energy: 0.45, crowdLevel: 0.9, discovery: 0.1, signature: 0.9,
    durationTasteMin: 45, durationTypicalMin: 90, durationFullMin: 180,
    bestWindow: ["before 08:00", "after 17:30"], skipIf: ["limited_mobility", "packed_schedule"],
    costJpy: 0, bookingReq: "none", opensAt: null, closesAt: null, closedWeekdays: [],
    conflictsWith: ["kyt-arashiyama-bamboo"], nearestStation: "inari", stationWalkMin: 2,
    crowdNote: "10:00–16:00 the first 300 gates are a shuffling queue." },

  { ...base, id: "kyt-tofukuji", name: "Tofuku-ji", category: "temple",
    interestTags: ["shrines", "nature"], energy: 0.3, crowdLevel: 0.7, discovery: 0.3, signature: 0.6,
    durationTasteMin: 30, durationTypicalMin: 60, durationFullMin: 90,
    bestWindow: ["before 09:30"], skipIf: [], costJpy: 1000, bookingReq: "none",
    opensAt: "08:30", closesAt: "16:30", closedWeekdays: [], conflictsWith: [],
    nearestStation: "tofukuji", stationWalkMin: 10, seasons: ["koyo"] },

  { ...base, id: "kyt-sanjusangendo", name: "Sanjusangen-do", category: "temple",
    interestTags: ["shrines", "history", "art"], energy: 0.1, crowdLevel: 0.4, discovery: 0.3, signature: 0.6,
    durationTasteMin: 30, durationTypicalMin: 50, durationFullMin: 70,
    bestWindow: [], skipIf: [], costJpy: 600, bookingReq: "none",
    opensAt: "08:30", closesAt: "17:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: "shichijo", stationWalkMin: 7 },

  { ...base, id: "kyt-kiyomizu", name: "Kiyomizu-dera", category: "temple",
    interestTags: ["shrines", "history"], energy: 0.5, crowdLevel: 0.95, discovery: 0.05, signature: 0.95,
    durationTasteMin: 45, durationTypicalMin: 90, durationFullMin: 120,
    bestWindow: ["before 08:00"], skipIf: ["limited_mobility"], costJpy: 500, bookingReq: "none",
    opensAt: "06:00", closesAt: "18:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: "kiyomizu-gojo", stationWalkMin: 20, seasons: ["koyo", "sakura"], pairsWith: ["kyt-ninenzaka"] },

  { ...base, id: "kyt-ninenzaka", name: "Ninenzaka & Sannenzaka", category: "street",
    interestTags: ["history", "shopping"], energy: 0.3, crowdLevel: 0.8, discovery: 0.2, signature: 0.6,
    durationTasteMin: 30, durationTypicalMin: 75, durationFullMin: 120,
    bestWindow: [], skipIf: [], costJpy: 0, bookingReq: "none",
    opensAt: null, closesAt: null, closedWeekdays: [], conflictsWith: [],
    nearestStation: "kiyomizu-gojo", stationWalkMin: 15, pairsWith: ["kyt-kiyomizu"] },

  { ...base, id: "kyt-arashiyama-bamboo", name: "Arashiyama Bamboo Grove", category: "nature",
    interestTags: ["nature"], energy: 0.35, crowdLevel: 0.9, discovery: 0.1, signature: 0.8,
    durationTasteMin: 30, durationTypicalMin: 60, durationFullMin: 150,
    bestWindow: ["before 08:00"], skipIf: [], costJpy: 0, bookingReq: "none",
    opensAt: null, closesAt: null, closedWeekdays: [], conflictsWith: ["kyt-fushimi-inari"],
    nearestStation: "saga-arashiyama", stationWalkMin: 12, seasons: ["koyo"] },

  { ...base, id: "kyt-kinkakuji", name: "Kinkaku-ji", category: "temple",
    interestTags: ["shrines", "history"], energy: 0.2, crowdLevel: 0.9, discovery: 0.05, signature: 0.9,
    durationTasteMin: 30, durationTypicalMin: 45, durationFullMin: 60,
    bestWindow: [], skipIf: [], costJpy: 500, bookingReq: "none",
    opensAt: "09:00", closesAt: "17:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: null, stationWalkMin: null },

  { ...base, id: "kyt-ginkakuji", name: "Ginkaku-ji", category: "temple",
    interestTags: ["shrines", "nature"], energy: 0.35, crowdLevel: 0.5, discovery: 0.4, signature: 0.6,
    durationTasteMin: 30, durationTypicalMin: 60, durationFullMin: 90,
    bestWindow: [], skipIf: [], costJpy: 500, bookingReq: "none",
    opensAt: "08:30", closesAt: "17:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: null, stationWalkMin: null, seasons: ["koyo"] },

  { ...base, id: "kyt-nishiki-market", name: "Nishiki Market", category: "market",
    interestTags: ["food", "shopping"], energy: 0.2, crowdLevel: 0.8, discovery: 0.2, signature: 0.5,
    durationTasteMin: 30, durationTypicalMin: 60, durationFullMin: 90,
    bestWindow: [], skipIf: [], costJpy: 0, bookingReq: "none",
    opensAt: "10:00", closesAt: "18:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: "gion-shijo", stationWalkMin: 8 },

  { ...base, id: "kyt-national-museum", name: "Kyoto National Museum", category: "museum",
    interestTags: ["art", "history"], energy: 0.1, crowdLevel: 0.3, discovery: 0.4, signature: 0.4,
    durationTasteMin: 45, durationTypicalMin: 90, durationFullMin: 150,
    bestWindow: [], skipIf: [], costJpy: 700, bookingReq: "none",
    opensAt: "09:30", closesAt: "17:00", closedWeekdays: [1], conflictsWith: [],
    nearestStation: "shichijo", stationWalkMin: 7 },

  { ...base, id: "kyt-nijo-castle", name: "Nijo Castle", category: "castle",
    interestTags: ["history"], energy: 0.3, crowdLevel: 0.6, discovery: 0.2, signature: 0.7,
    durationTasteMin: 45, durationTypicalMin: 90, durationFullMin: 120,
    bestWindow: [], skipIf: [], costJpy: 1300, bookingReq: "none",
    opensAt: "08:45", closesAt: "17:00", closedWeekdays: [], conflictsWith: [],
    nearestStation: null, stationWalkMin: null },

  // ---- the traps
  { ...base, id: "kyt-daimonji-hike", name: "Daimonji trail", category: "hike",
    interestTags: ["nature"], energy: 0.9, crowdLevel: 0.2, discovery: 0.7, signature: 0.5,
    durationTasteMin: 60, durationTypicalMin: 120, durationFullMin: 180,
    bestWindow: [], skipIf: ["limited_mobility"], costJpy: 0, bookingReq: "none",
    opensAt: null, closesAt: null, closedWeekdays: [], conflictsWith: [],
    nearestStation: null, stationWalkMin: null, physicalDemand: 0.9 },

  { ...base, id: "kyt-saihoji", name: "Saiho-ji (Kokedera)", category: "temple",
    interestTags: ["shrines", "nature"], energy: 0.2, crowdLevel: 0.2, discovery: 0.6, signature: 0.7,
    durationTasteMin: 60, durationTypicalMin: 90, durationFullMin: 120,
    bestWindow: [], skipIf: [], costJpy: 4000, bookingReq: "required", bookingLeadDays: 30,
    opensAt: null, closesAt: null, closedWeekdays: [], conflictsWith: [],
    nearestStation: null, stationWalkMin: null },

  { ...base, id: "kyt-draft-teahouse", name: "A teahouse someone drafted", category: "cafe",
    interestTags: ["food"], energy: 0.1, crowdLevel: 0.3, discovery: 0.8, signature: 0.3,
    // Through the gate a draft's judgement fields are NULL.
    durationTasteMin: null, durationTypicalMin: null, durationFullMin: null,
    bestWindow: [], skipIf: [], costJpy: 1200, bookingReq: "none",
    opensAt: null, closesAt: null, closedWeekdays: [], conflictsWith: [],
    nearestStation: "gion-shijo", stationWalkMin: 5, verificationStatus: "draft" },
];

/** The owner (§16): standard pace, avoids crowds, shrines + history +
 *  scenery, never beaches or hiking. */
export const owner: TravellerInput = {
  pace: "standard",
  interestTags: ["shrines", "history", "nature"],
  energy: 0.25,
  crowdTolerance: 0.15,
  discovery: 0.5,
  excludes: ["beaches", "hiking"],
  mobility: [],
  budgetBand: "mid",
};
