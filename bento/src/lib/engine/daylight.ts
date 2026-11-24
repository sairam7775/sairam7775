/** Daylight for a hike: a trail has no closing time, but it gets dark.
 *  Pure arithmetic, no network: NOAA's low-precision solar formulas
 *  (good to a few minutes in Japan's latitudes), times in Japan time. */
import type { PlaceInput } from "./types";

/** A hike ends this long before sunset: under trees, on a slope, the light
 *  goes well before the sun does. An assumption, not a published rule. */
export const HIKE_DAYLIGHT_MARGIN_MIN = 60;

const JST_OFFSET_MIN = 9 * 60;
const rad = (d: number) => (d * Math.PI) / 180;

/** Minutes after midnight, Japan time, when the sun sets on `date`
 *  ("YYYY-MM-DD") at this latitude and longitude (east positive). */
export function sunsetMin(date: string, lat: number, lon: number): number {
  const d = new Date(`${date}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.round((d.getTime() - start) / 86_400_000) + 1;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  // 90.833°: the sun's upper edge on the horizon, with refraction.
  const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  const ha = (Math.acos(Math.max(-1, Math.min(1, cosHa))) * 180) / Math.PI;
  const utc = 720 - 4 * (lon - ha) - eqTime;
  return Math.round(utc + JST_OFFSET_MIN);
}

/** When a hike must be finished on `date`: sunset less the margin. Null for
 *  any other place, and for a hike with no position. */
export function daylightEndMin(p: PlaceInput, date: string): number | null {
  if (p.category !== "hike" || p.lat == null || p.lon == null) return null;
  return sunsetMin(date, p.lat, p.lon) - HIKE_DAYLIGHT_MARGIN_MIN;
}
