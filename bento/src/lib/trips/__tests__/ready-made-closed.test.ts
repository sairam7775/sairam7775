import { describe, expect, it } from "vitest";
import { placeSeeds } from "@/lib/places/seed";
import { copy } from "@/copy";
import { readyMadeTrips } from "../ready-made";
import { closedMustSees, closedMustSeeWords, type ClosingFacts } from "../ready-made/closed";

const seeds = new Map<string, ClosingFacts>(placeSeeds.flatMap((s) => s.places).map((p) => [p.id, p]));
const trip = (id: string) => readyMadeTrips.find((t) => t.id === id)!;
const e = copy.readyMade.picker.errors;

describe("closedMustSees", () => {
  it("finds Osaka Castle closed over the year-end break on the day each start puts it", () => {
    expect(closedMustSees(trip("osaka-day"), "2026-12-30", seeds)).toEqual([
      { placeId: "osk-osaka-castle", name: "Osaka Castle", day: 1, date: "2026-12-30", why: { kind: "yearly", range: "12-28..01-01" } },
    ]);
    expect(closedMustSees(trip("osaka-day"), "2027-01-01", seeds).map((c) => c.date)).toEqual(["2027-01-01"]);
    // Day 2 of the five days is 31 Dec.
    expect(closedMustSees(trip("osaka-kyoto-nara-5"), "2026-12-30", seeds)).toEqual([
      { placeId: "osk-osaka-castle", name: "Osaka Castle", day: 2, date: "2026-12-31", why: { kind: "yearly", range: "12-28..01-01" } },
    ]);
  });

  it("finds nothing when the start keeps every must-see on an open day", () => {
    expect(closedMustSees(trip("osaka-day"), "2027-01-02", seeds)).toEqual([]);
    expect(closedMustSees(trip("osaka-kyoto-nara-5"), "2027-01-01", seeds)).toEqual([]);
    expect(closedMustSees(trip("osaka-kyoto-nara-5"), "2026-12-26", seeds)).toEqual([]);
  });

  it("finds a weekly closing day and a one-off closed date too", () => {
    const castle = seeds.get("osk-osaka-castle")!;
    // 10 May 2027 is a Monday.
    const mondays = new Map([["osk-osaka-castle", { ...castle, closedWeekdays: [1] }]]);
    expect(closedMustSees(trip("osaka-day"), "2027-05-10", mondays)[0].why).toEqual({ kind: "weekly", weekday: 1 });
    expect(closedMustSees(trip("osaka-day"), "2027-05-11", mondays)).toEqual([]);
    const once = new Map([["osk-osaka-castle", { ...castle, closedDates: ["2027-05-11"] }]]);
    expect(closedMustSees(trip("osaka-day"), "2027-05-11", once)[0].why).toEqual({ kind: "date" });
    expect(closedMustSees(trip("osaka-day"), "2027-05-12", once)).toEqual([]);
  });

  it("skips a must-see it has no facts for (the catalogue check refuses that one)", () => {
    expect(closedMustSees(trip("osaka-day"), "2026-12-30", new Map())).toEqual([]);
  });
});

describe("closedMustSeeWords", () => {
  it("names the place, its closure and the day, and asks for another first day", () => {
    const [c] = closedMustSees(trip("osaka-kyoto-nara-5"), "2026-12-30", seeds);
    expect(closedMustSeeWords(c)).toBe(e.closedYearly("Osaka Castle", "28 Dec – 1 Jan", "Thu 31 Dec"));
    expect(closedMustSeeWords(c)).toBe("Osaka Castle is closed 28 Dec – 1 Jan every year, and this start puts it on Thu 31 Dec. Pick another first day.");
    expect(closedMustSeeWords({ ...c, date: "2027-05-10", why: { kind: "weekly", weekday: 1 } }))
      .toBe("Osaka Castle is closed on Mondays, and this start puts it on Mon 10 May. Pick another first day.");
    expect(closedMustSeeWords({ ...c, date: "2027-05-11", why: { kind: "date" } }))
      .toBe("Osaka Castle is closed on Tue 11 May, the day this start puts it on. Pick another first day.");
  });
});
