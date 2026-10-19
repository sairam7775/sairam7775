import type { BackgroundChoice } from "@/components/seasonal/season";
import type { Theme } from "@/lib/theme";
import { copy } from "@/copy";

/** The second line of each row on the Settings list: what's set now, so
 *  the traveller can tell without opening the page. */
const t = copy.settings;

export function personalSummary(name: string, email: string): string {
  return t.summary.personal(name, email);
}

export function appearanceSummary(theme: Theme, background: BackgroundChoice): string {
  return t.summary.appearance(t.theme[theme], t.background[background]);
}

/** null where analytics can't run (no key), so it isn't mentioned. */
export function privacySummary(analytics: boolean | null): string {
  return t.summary.privacy(analytics);
}
