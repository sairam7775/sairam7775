import { describe, expect, it } from "vitest";
import { bookedPlaceIds, bookingHoldsPlace } from "../match";

const ghibli = { id: "ghibli", name: "Ghibli Museum (Mitaka)" };
const planets = { id: "tl-planets", name: "teamLab Planets" };
const borderless = { id: "tl-borderless", name: "teamLab Borderless" };
const fushimi = { id: "fushimi", name: "Fushimi Inari Taisha · 伏見稲荷大社" };
const ticket = (title: string, startsOn = "2026-11-21", placeId: string | null = null, type = "activity") => ({ type, title, startsOn, placeId });

describe("bookingHoldsPlace", () => {
  it("a linked booking holds its place on its date", () => {
    expect(bookingHoldsPlace(ticket("anything", "2026-11-21", "ghibli"), ghibli, "2026-11-21")).toBe(true);
    expect(bookingHoldsPlace(ticket("anything", "2026-11-22", "ghibli"), ghibli, "2026-11-21")).toBe(false);
    expect(bookingHoldsPlace(ticket("Ghibli Museum", "2026-11-21", "other"), ghibli, "2026-11-21")).toBe(false);
  });
  it("an unlinked activity holds a place whose name its title contains", () => {
    expect(bookingHoldsPlace(ticket("Ghibli Museum ticket, 10:00"), ghibli, "2026-11-21")).toBe(true);
    expect(bookingHoldsPlace(ticket("GHIBLI MUSEUM"), ghibli, "2026-11-21")).toBe(true);
    expect(bookingHoldsPlace(ticket("Fushimi Inari Taisha guided walk"), fushimi, "2026-11-21")).toBe(true);
  });
  it("is conservative: vague titles, other teamLabs, other days and other kinds hold nothing", () => {
    expect(bookingHoldsPlace(ticket("Museum ticket"), ghibli, "2026-11-21")).toBe(false);
    expect(bookingHoldsPlace(ticket("teamLab Planets"), borderless, "2026-11-21")).toBe(false);
    expect(bookingHoldsPlace(ticket("Ghibli Museum", "2026-11-22"), ghibli, "2026-11-21")).toBe(false);
    expect(bookingHoldsPlace(ticket("Ghibli Museum", "2026-11-21", null, "restaurant"), ghibli, "2026-11-21")).toBe(false);
  });
});

describe("bookedPlaceIds", () => {
  it("lists only the places some booking holds", () => {
    expect(bookedPlaceIds([ticket("teamLab Planets 19:00")], [planets, borderless, ghibli], "2026-11-21")).toEqual(["tl-planets"]);
  });
});
