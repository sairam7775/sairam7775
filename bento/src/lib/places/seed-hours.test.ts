import { describe, expect, it } from "vitest";
import { himeji } from "./seed/himeji";
import { hiroshima } from "./seed/hiroshima";
import { kyoto } from "./seed/kyoto";
import { miyajima } from "./seed/miyajima";
import { nara } from "./seed/nara";
import { osaka } from "./seed/osaka";

const all = [...kyoto, ...osaka, ...nara, ...hiroshima, ...miyajima, ...himeji];
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Clock times named in a sentence, in minutes: "7:30", "17:30", "6am", "7 pm". */
function timesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/gi)) {
    if (m[3]) {
      const h = Number(m[1]) % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0);
      out.push(h * 60 + Number(m[2] ?? 0));
    } else out.push(Number(m[4]) * 60 + Number(m[5]));
  }
  return out;
}

describe("seasonal hours in the seed", () => {
  // A seasonal place stores the shortest hours of its year (0026), so its
  // tip must not send anyone earlier or later than those hours.
  it("never names a time outside a seasonal place's stored hours", () => {
    const outside = all
      .filter((p) => p.hoursVary && p.opens && p.closes)
      .flatMap((p) =>
        [p.tip, p.crowdNote].flatMap((text) =>
          timesIn(text)
            .filter((t) => t < minutes(p.opens!) || t > minutes(p.closes!))
            .map(() => `${p.id}: "${text}" (${p.opens}–${p.closes})`),
        ),
      );
    expect(outside).toEqual([]);
  });

  it("reads the clock times a tip can name", () => {
    expect(timesIn("Come at 7:30, or by 6am, never after 5 pm or 17:45.")).toEqual([450, 360, 1020, 1065]);
  });
});
