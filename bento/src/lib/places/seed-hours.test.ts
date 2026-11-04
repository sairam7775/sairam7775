import { describe, expect, it } from "vitest";
import type { PlaceSeed } from "./seed/types";
import { himeji } from "./seed/himeji";
import { hiroshima } from "./seed/hiroshima";
import { kyoto } from "./seed/kyoto";
import { miyajima } from "./seed/miyajima";
import { nara } from "./seed/nara";
import { osaka } from "./seed/osaka";
import { tokyo } from "./seed/tokyo";

const all = [...kyoto, ...osaka, ...nara, ...hiroshima, ...miyajima, ...himeji, ...tokyo];
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

const LATE_OPENING = /\bopens? until (\d{1,2}:\d{2})\b(?=[^.;]*\bon (?:mon|tues|wednes|thurs|fri|satur|sun)days?\b)/gi;

/** A sentence with any named late opening ("Open until 19:30 on Saturdays")
 *  taken out, so the times left over can be checked. Only a closing later
 *  than the stored one, on named weekdays, counts as a late opening. */
function withoutLateOpenings(text: string, closes: string): string {
  return text.replace(LATE_OPENING, (whole, time: string) => (minutes(time.padStart(5, "0")) > minutes(closes) ? "" : whole));
}

/** Each time in a place's tip or crowd note that falls outside its stored
 *  hours, as a readable line. */
function outsideHours(places: PlaceSeed[], exemptLateOpenings: boolean): string[] {
  return places
    .filter((p) => p.opens && p.closes)
    .flatMap((p) =>
      [p.tip, p.crowdNote].flatMap((text) => {
        const checked = exemptLateOpenings ? withoutLateOpenings(text ?? "", p.closes!) : text ?? "";
        return timesIn(checked)
          .filter((t) => t < minutes(p.opens!) || t > minutes(p.closes!))
          .map((t) => `${p.id}: ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} in "${text}" (${p.opens}–${p.closes})`);
      }),
    );
}

// Every time is read against the place's own hours. When a tip names a time
// at another place ("Tenryu-ji opens at 8:30 next door"), reword the tip
// rather than widening these checks.
describe("hours named in the seed's tips", () => {
  // A seasonal place stores the shortest hours of its year (0026), so its
  // tip must not send anyone earlier or later than those hours.
  it("never names a time outside a seasonal place's stored hours", () => {
    expect(outsideHours(all.filter((p) => p.hoursVary), false)).toEqual([]);
  });

  // A place with fixed hours can still name a later closing on named days.
  // Every other time must fall inside the stored hours, so the planner and
  // the tip never disagree.
  it("never names a time outside a fixed-hours place's stored hours, except a named late opening", () => {
    expect(outsideHours(all.filter((p) => !p.hoursVary), true)).toEqual([]);
  });

  it("takes out only a named late opening", () => {
    const keep = (text: string) => timesIn(withoutLateOpenings(text, "17:00"));
    expect(keep("Open until 19:30 on Saturdays; special exhibitions cost extra.")).toEqual([]);
    expect(keep("Open until 20:00 on Fridays and Saturdays.")).toEqual([]);
    expect(keep("Open until 20:00 on Fridays, but queue from 6:00.")).toEqual([360]);
    expect(keep("Open until 20:00 on Fridays; come at 7am.")).toEqual([420]);
    expect(keep("Open until 06:00 on Sundays.")).toEqual([360]);
    expect(keep("Opens late in summer, until 21:00.")).toEqual([1260]);
    expect(keep("Come back at 19:30 for the view.")).toEqual([1170]);
    expect(keep("Open late most nights but closes at 16:00 on Tuesdays.")).toEqual([960]);
  });

  it("reads the clock times a tip can name", () => {
    expect(timesIn("Come at 7:30, or by 6am, never after 5 pm or 17:45.")).toEqual([450, 360, 1020, 1065]);
  });
});
