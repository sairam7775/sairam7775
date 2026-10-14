import { describe, expect, it, vi } from "vitest";
import { TOURS, TOUR_IDS } from "./steps";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

describe("tours", () => {
  it("every tour has steps with a title and a body", () => {
    for (const id of TOUR_IDS) {
      expect(TOURS[id].length).toBeGreaterThan(0);
      for (const s of TOURS[id]) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });
  it("covers the three pages", () => {
    expect(TOUR_IDS.sort()).toEqual(["trip", "trips", "vault"]);
  });
});

describe("parseSeen", () => {
  it("reads the cookie, ignoring anything that isn't a tour", async () => {
    const { parseSeen } = await import("./seen");
    expect(parseSeen(undefined)).toEqual([]);
    expect(parseSeen("trips.trip")).toEqual(["trips", "trip"]);
    expect(parseSeen("trips.<script>.nope.vault")).toEqual(["trips", "vault"]);
  });
});
