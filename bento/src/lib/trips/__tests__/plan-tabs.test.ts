import { describe, expect, it } from "vitest";
import { initialPlanTab, parsePlanTab, planTabSearch, planTabs } from "../plan-tabs";

describe("parsePlanTab", () => {
  it("opens the ready-made trips for ?tab=ready-made", () => {
    expect(parsePlanTab("ready-made")).toBe("ready-made");
  });

  it("falls back to the form for anything else", () => {
    expect(parsePlanTab(undefined)).toBe("own");
    expect(parsePlanTab("")).toBe("own");
    expect(parsePlanTab("own")).toBe("own");
    expect(parsePlanTab("Ready-Made")).toBe("own");
    expect(parsePlanTab("ready-made ")).toBe("own");
    expect(parsePlanTab("nonsense")).toBe("own");
  });

  it("reads the first value when the parameter is repeated", () => {
    expect(parsePlanTab(["ready-made", "own"])).toBe("ready-made");
    expect(parsePlanTab(["own", "ready-made"])).toBe("own");
    expect(parsePlanTab([])).toBe("own");
  });
});

describe("planTabs", () => {
  it("shows both tabs, the form first, when a ready-made trip can be offered", () => {
    expect(planTabs(1)).toEqual(["own", "ready-made"]);
    expect(planTabs(12)).toEqual(["own", "ready-made"]);
  });

  it("shows only the form when no ready-made trip can be offered", () => {
    expect(planTabs(0)).toEqual(["own"]);
  });
});

describe("initialPlanTab", () => {
  it("opens the tab the address asks for when it is shown", () => {
    expect(initialPlanTab("ready-made", 3)).toBe("ready-made");
    expect(initialPlanTab(undefined, 3)).toBe("own");
  });

  it("opens the form when the ready-made tab isn't shown", () => {
    expect(initialPlanTab("ready-made", 0)).toBe("own");
  });
});

describe("planTabSearch", () => {
  it("adds the tab for the ready-made trips and leaves the form's address plain", () => {
    expect(planTabSearch("", "ready-made")).toBe("?tab=ready-made");
    expect(planTabSearch("?tab=ready-made", "own")).toBe("");
    expect(planTabSearch("", "own")).toBe("");
  });

  it("keeps any other parameter", () => {
    expect(planTabSearch("?season=winter", "ready-made")).toBe("?season=winter&tab=ready-made");
    expect(planTabSearch("?season=winter&tab=ready-made", "own")).toBe("?season=winter");
    expect(planTabSearch("?tab=nonsense", "ready-made")).toBe("?tab=ready-made");
  });

  it("round-trips through parsePlanTab", () => {
    for (const tab of ["own", "ready-made"] as const) {
      const value = new URLSearchParams(planTabSearch("?season=winter", tab)).get("tab") ?? undefined;
      expect(parsePlanTab(value)).toBe(tab);
    }
  });
});
