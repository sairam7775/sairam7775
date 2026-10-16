/** Light or dark, chosen in Settings. "system" follows the device. A
 *  cookie, read by the root layout, so the page arrives in the right
 *  palette with no flash; nothing is stored against the account, so each
 *  device keeps its own choice. */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "bento_theme";

export function parseTheme(value: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "system";
}
