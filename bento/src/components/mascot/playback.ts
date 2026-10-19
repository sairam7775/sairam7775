import { FILES } from "./moods";
import type { FigureKey } from "./types";

/** The decisions behind playing Bento Man, kept pure so they can be tested.
 *  The component (figure.tsx) only wires them to the browser. */

/** Where a figure's Lottie file is, or null for a still-only figure. */
export function fileFor(key: FigureKey): string | null {
  return FILES.includes(key) ? `/mascot/${key}.json` : null;
}

/** Whether to load the player at all. With reduced motion, never. */
export function shouldAnimate({ reducedMotion, file }: { reducedMotion: boolean; file: string | null }): boolean {
  return !reducedMotion && file !== null;
}

/** Whether a proposal card's status change is the traveller accepting it —
 *  the moment Bento Man cheers. */
export function cheers(prev: string, next: string): boolean {
  return prev === "proposed" && next === "accepted";
}

/** The intro (null when it has no frames) and the idle loop, as frame ranges. */
export function segmentsOf(markers: { cm: string; tm: number; dr: number }[]): { intro: [number, number] | null; idle: [number, number] } {
  const intro = markers.find((m) => m.cm === "intro");
  const idle = markers.find((m) => m.cm === "idle");
  if (!idle) throw new Error("a Bento Man file needs an idle marker");
  return {
    intro: intro && intro.dr > 0 ? [intro.tm, intro.tm + intro.dr] : null,
    idle: [idle.tm, idle.tm + idle.dr],
  };
}
