export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** Japan's seasons by month: Mar–May spring, Jun–Aug summer, Sep–Nov
 *  autumn, Dec–Feb winter. Takes a Date or a "YYYY-MM-DD" string. */
export function seasonOf(date: Date | string): Season {
  const month = typeof date === "string" ? Number(date.slice(5, 7)) : date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function isSeason(x: unknown): x is Season {
  return typeof x === "string" && (SEASONS as string[]).includes(x);
}

/** Deterministic 0–1 noise, so particle layouts are stable across renders. */
export function noise(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
