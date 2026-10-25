import { copy } from "@/copy";

/** What a place costs, as travellers see it: a band, never a figure.
 *
 *  Prices change more often than anyone can keep up with. A band moves
 *  only when a price jumps, so `cost_jpy` (the main paid entry for one
 *  adult) needs fixing only then. The engine still sums the stored figure
 *  for a day's budget, which is why a day's total reads as an estimate. */
export type CostBand = keyof typeof copy.plan.costBand;

/** Exclusive upper bounds, cheapest first; anything above is "over3000". */
const BANDS: [number, CostBand][] = [[1, "free"], [500, "under500"], [1500, "to1500"], [3000, "to3000"]];

export function costBand(jpy: number | null | undefined): CostBand | null {
  if (jpy == null) return null;
  for (const [below, band] of BANDS) if (jpy < below) return band;
  return "over3000";
}

/** The band in words ("¥500–1,500"), or null with no price on record. */
export function costBandWords(jpy: number | null | undefined): string | null {
  const band = costBand(jpy);
  return band ? copy.plan.costBand[band] : null;
}
