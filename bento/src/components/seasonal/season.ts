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

/** Scenes that aren't a season: only ever shown when chosen (Settings or a
 *  `?season=` preview), never by date. */
export const SCENE_THEMES = ["tsuyu", "fuji", "night", "matsuri", "shrine"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

/** Anything the backdrop can draw: a season or a scene. */
export type Background = Season | SceneTheme;

export function isBackground(x: unknown): x is Background {
  return isSeason(x) || (typeof x === "string" && (SCENE_THEMES as readonly string[]).includes(x));
}

/** Settings → Background: "auto" follows the date (or a trip's own season
 *  on its page); a season or a scene shows that one everywhere. A cookie,
 *  per device, read by the root layout. */
export const BACKGROUNDS = ["auto", "spring", "summer", "autumn", "winter", ...SCENE_THEMES] as const;
export type BackgroundChoice = (typeof BACKGROUNDS)[number];
export const BACKGROUND_COOKIE = "bento_season";

export function parseBackground(value: string | undefined): BackgroundChoice {
  return isBackground(value) ? value : "auto";
}

/** `?season=fuji` in the address previews any season or scene. */
export function previewOf(search: string): Background | null {
  const q = new URLSearchParams(search).get("season");
  return isBackground(q) ? q : null;
}

/** Deterministic 0–1 noise, so particle layouts are stable across renders. */
export function noise(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
