import { describe, expect, it } from "vitest";
import { placeSeeds } from "@/lib/places/seed";
import { copy } from "@/copy";
import { readyMadeTrips } from "../ready-made";
import { closedMustSees, closedMustSeeWords, nearestOpenStart, type ClosingFacts } from "../ready-made/closed";
import type { ReadyMadeTrip } from "../ready-made/types";

const seeds = new Map<string, ClosingFacts>(placeSeeds.flatMap((s) => s.places).map((p) => [p.id, p]));
const trip = (id: string) => readyMadeTrips.find((t) => t.id === id)!;
const e = copy.readyMade.picker.errors;
// The seven-day trip as it was before it ended in Osaka (23 Nov 2026): the
// Peace Memorial Museum on day 6 and Shukkeien on day 7, so one start puts
// two must-sees on closed days. No published trip does that now.
const twoClosed: ReadyMadeTrip = {
  ...trip("kansai-hiroshima-7"),
  route: [{ cityId: "osaka-city", nights: 2 }, { cityId: "nara-city", nights: 0 }, { cityId: "kyoto-city", nights: 2 }, { cityId: "himeji", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }],
  dayTrips: [{ day: 2, cityId: "nara-city" }, { day: 5, cityId: "himeji" }],
  mustSee: [["osk-dotonbori"], ["nra-todaiji", "nra-kasuga-taisha"], ["kyt-kiyomizu", "kyt-gion"], ["kyt-arashiyama-bamboo", "kyt-kinkakuji"], ["hmj-castle", "hmj-kokoen"], ["hir-peace-park", "hir-peace-museum"], ["hir-shukkeien"]],
};

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

describe("nearestOpenStart", () => {
  it("finds the nearest start that keeps every must-see open, the earlier on a tie", () => {
    // osaka-day: 27 Dec and 2 Jan are both three days from 30 Dec.
    expect(nearestOpenStart(trip("osaka-day"), "2026-12-30", seeds, "2026-11-18")).toBe("2026-12-27");
    expect(nearestOpenStart(trip("osaka-day"), "2027-01-01", seeds, "2026-11-18")).toBe("2027-01-02");
    expect(nearestOpenStart(trip("osaka-kyoto-nara-5"), "2026-12-30", seeds, "2026-11-18")).toBe("2027-01-01");
    expect(nearestOpenStart(twoClosed, "2026-12-25", seeds, "2026-11-18")).toBe("2026-12-27");
  });

  it("never suggests a day before the earliest allowed one", () => {
    expect(nearestOpenStart(trip("osaka-day"), "2026-12-30", seeds, "2026-12-29")).toBe("2027-01-02");
  });

  it("gives up when no start nearby works", () => {
    const castle = seeds.get("osk-osaka-castle")!;
    const never = new Map([["osk-osaka-castle", { ...castle, closedWeekdays: [0, 1, 2, 3, 4, 5, 6] }]]);
    expect(nearestOpenStart(trip("osaka-day"), "2027-05-10", never, "2026-11-18")).toBeNull();
  });
});

describe("closedMustSeeWords", () => {
  it("names every closed must-see, its closure and its day, then the nearest first day that works", () => {
    const one = closedMustSees(trip("osaka-kyoto-nara-5"), "2026-12-30", seeds);
    expect(closedMustSeeWords(one, "2027-01-01"))
      .toBe("Osaka Castle is closed 28 Dec – 1 Jan every year, and this start puts it on Thu 31 Dec. The nearest first day that works is Fri 1 Jan.");
    const two = closedMustSees(twoClosed, "2026-12-25", seeds);
    expect(closedMustSeeWords(two, "2026-12-27")).toBe(
      "Peace Memorial Museum is closed 30 Dec – 31 Dec every year, and this start puts it on Wed 30 Dec. " +
        "Shukkeien Garden is closed 29 Dec – 31 Dec every year, and this start puts it on Thu 31 Dec. " +
        "The nearest first day that works is Sun 27 Dec.",
    );
  });

  it("words weekly and one-off closures, and asks for another first day when none nearby works", () => {
    const [c] = closedMustSees(trip("osaka-day"), "2026-12-30", seeds);
    expect(closedMustSeeWords([{ ...c, date: "2027-05-10", why: { kind: "weekly", weekday: 1 } }], null))
      .toBe("Osaka Castle is closed on Mondays, and this start puts it on Mon 10 May. " + e.closedPickAnother);
    expect(closedMustSeeWords([{ ...c, date: "2027-05-11", why: { kind: "date" } }], null))
      .toBe("Osaka Castle is closed on Tue 11 May, the day this start puts it on. Pick another first day.");
  });
});
