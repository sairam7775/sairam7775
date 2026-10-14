import type { PlaceInput } from "@/lib/engine/types";
import type { CoverageTier, VerificationStatus } from "@/lib/types";
import type { PlaceSeed } from "./types";

/** A seed record in the shape the engine reads. The database does this
 *  through places_public; the in-memory store (evals, tests) does it here,
 *  with the status the caller asserts — a test may treat a draft as
 *  verified, the product never does. */
export function seedToPlaceInput(
  s: PlaceSeed,
  opts: { tier?: CoverageTier; status?: VerificationStatus } = {},
): PlaceInput {
  return {
    id: s.id,
    cityId: s.city,
    name: s.name,
    category: s.category,
    interestTags: s.tags,
    energy: s.energy,
    crowdLevel: s.crowd,
    discovery: s.discovery,
    signature: s.signature,
    physicalDemand: s.physical ?? null,
    durationTasteMin: s.taste,
    durationTypicalMin: s.typical,
    durationFullMin: s.full,
    bestWindow: s.window ?? [],
    skipIf: s.skipIf ?? [],
    worthItIf: s.worthIf ?? [],
    costJpy: s.cost,
    bookingReq: s.booking ?? "none",
    bookingLeadDays: s.lead ?? null,
    opensAt: s.opens ?? null,
    closesAt: s.closes ?? null,
    closedWeekdays: s.closedWeekdays ?? [],
    closedDates: [],
    conflictsWith: s.conflicts ?? [],
    pairsWith: s.pairs ?? [],
    verificationStatus: opts.status ?? "verified",
    coverageTier: opts.tier ?? "deep",
    nearestStation: s.station,
    stationWalkMin: s.walk,
    seasons: s.seasons ?? [],
    crowdNote: s.crowdNote,
    localTip: s.tip,
  };
}
