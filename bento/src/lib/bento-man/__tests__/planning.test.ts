/** plan_days against what the traveller actually holds and has agreed:
 *  tickets they booked, dates inside the trip, and a route proposed in the
 *  same turn. */
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { runTool, type ToolContext } from "../tools";

const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
const prefs = { pace: "standard" as const, interestTags: ["art", "nature"] as ("art" | "nature")[], energy: 0.4, crowdTolerance: 0.6, discovery: 0.5, excludes: [] };
const ctxFor = (store: MemoryStore): ToolContext => ({ store, today: "2026-09-15", proposal: null });
const osakaFirst = { trip: nov, prefs, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }] };

const ticketRejection = (ctx: ToolContext) =>
  ctx.proposal?.days[0].considered.find((c) => c.name === "teamLab Botanical Garden" && c.term === "booking_required");

describe("booked tickets", () => {
  it("without a ticket, a booking-required place is left out and says why", async () => {
    const ctx = ctxFor(new MemoryStore(osakaFirst));
    await runTool("plan_days", { dates: [{ date: "2026-11-21" }] }, ctx);
    expect(ticketRejection(ctx)).toBeDefined();
  });

  it("a ticket the traveller recorded lets it in", async () => {
    const store = new MemoryStore({
      ...osakaFirst,
      bookings: [{ type: "activity", title: "teamLab Botanical Garden 19:00", startsOn: "2026-11-21", placeId: null }],
    });
    const ctx = ctxFor(store);
    await runTool("plan_days", { dates: [{ date: "2026-11-21" }] }, ctx);
    expect(ticketRejection(ctx)).toBeUndefined();
  });

  it("a ticket for another day doesn't", async () => {
    const store = new MemoryStore({
      ...osakaFirst,
      bookings: [{ type: "activity", title: "teamLab Botanical Garden", startsOn: "2026-11-20", placeId: null }],
    });
    const ctx = ctxFor(store);
    await runTool("plan_days", { dates: [{ date: "2026-11-21" }] }, ctx);
    expect(ticketRejection(ctx)).toBeDefined();
  });
});

describe("plan_days dates", () => {
  it("refuses a date outside the trip, even with a city", async () => {
    const ctx = ctxFor(new MemoryStore(osakaFirst));
    const r = await runTool("plan_days", { dates: [{ date: "2026-12-25", city_id: "nara-city" }] }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/outside the trip/);
    expect(ctx.proposal).toBeNull();
  });
});

describe("a route proposed in the same turn", () => {
  it("plans days in the proposed route's cities, not the old route's", async () => {
    const ctx = ctxFor(new MemoryStore(osakaFirst));
    const proposed = await runTool("propose_route", {
      cities: [
        { city_id: "kyoto-city", nights: 7, reason: "Kyoto first" },
        { city_id: "hiroshima-city", nights: 2, reason: "then west" },
      ],
    }, ctx);
    expect(proposed.isError).toBeFalsy();
    await runTool("plan_days", { dates: [{ date: "2026-11-20" }] }, ctx);
    const day = ctx.proposal!.days.find((d) => d.date === "2026-11-20")!;
    expect(day.cityId).toBe("kyoto-city");
  });
});
