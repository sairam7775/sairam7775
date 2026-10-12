/** Changing a trip's dates: what counts as a change, what is refused, and
 *  what moves with it. The Edit trip form and set_trip_dates both rely on
 *  these through the store. */
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { planDateChange, shiftDate } from "../store";
import { runTool } from "../tools";

const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
const route = [{ nights: 2 }, { nights: 5 }, { nights: 2 }];

describe("planDateChange", () => {
  it("same dates are not a change", () => {
    expect(planDateChange(nov, { startDate: "2026-11-20", endDate: "2026-11-29" }, route)).toMatchObject({ changed: false, error: null, shift: 0 });
    expect(planDateChange(nov, {}, route).changed).toBe(false);
  });
  it("refuses a range too short for the route, with the arithmetic", () => {
    const r = planDateChange(nov, { endDate: "2026-11-23" }, route);
    expect(r.changed).toBe(true);
    expect(r.error).toContain("9 nights");
    expect(r.error).toContain("only 3");
  });
  it("refuses end before start", () => {
    expect(planDateChange(nov, { endDate: "2026-11-01" }, []).error).toMatch(/before the start/);
  });
  it("reports how far the start moved", () => {
    expect(planDateChange(nov, { startDate: "2026-11-27", endDate: "2026-12-06" }, route)).toMatchObject({ changed: true, error: null, shift: 7 });
    expect(planDateChange(nov, { startDate: "2026-11-18", endDate: "2026-11-29" }, route).shift).toBe(-2);
  });
  it("first dates on an undated trip shift nothing", () => {
    expect(planDateChange({ startDate: null, endDate: null }, nov, []).shift).toBe(0);
  });
});

describe("shiftDate", () => {
  it("crosses months and years", () => {
    expect(shiftDate("2026-11-28", 7)).toBe("2026-12-05");
    expect(shiftDate("2027-01-02", -5)).toBe("2026-12-28");
  });
});

describe("store.setTripDates", () => {
  const day = (date: string) => ({ date, cityId: "kyoto", items: [] });

  it("a rename leaves dates and planned days alone", async () => {
    const store = new MemoryStore({ trip: nov, days: [day("2026-11-22")] });
    await store.setTripDates({ title: "Kansai, autumn", startDate: nov.startDate, endDate: nov.endDate });
    const s = await store.state();
    expect(s.trip).toMatchObject({ title: "Kansai, autumn", ...nov });
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-22"]);
  });

  it("moving the trip moves the planned days with it", async () => {
    const store = new MemoryStore({ trip: nov, days: [day("2026-11-22"), day("2026-11-23")] });
    await store.setTripDates({ startDate: "2026-11-27", endDate: "2026-12-06" });
    expect((await store.state()).days.map((d) => d.date)).toEqual(["2026-11-29", "2026-11-30"]);
  });

  it("set_trip_dates hands a too-short range back as a refusal, not a crash", async () => {
    const store = new MemoryStore({ trip: nov });
    const ctx = { store, today: "2026-09-15", proposal: null };
    await store.applyProposal({
      summary: "route",
      route: { before: [], after: [{ cityId: "osaka", name: "Osaka", nights: 2, reason: "r", tier: "deep" }, { cityId: "kyoto", name: "Kyoto", nights: 7, reason: "r", tier: "deep" }], verdict: "fine", arithmetic: "" },
      days: [],
    } as never);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-11-23" }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toContain("9 nights");
    expect((await store.state()).trip).toMatchObject(nov);
  });
});
