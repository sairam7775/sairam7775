import { describe, expect, it } from "vitest";
import { kamakura } from "../seed/kamakura";
import { yokohama } from "../seed/yokohama";

const byId = new Map([...kamakura, ...yokohama].map((p) => [p.id, p]));
const get = (id: string) => {
  const p = byId.get(id);
  if (!p) throw new Error(`no place ${id}`);
  return p;
};

describe("Kamakura and Yokohama drafts", () => {
  // A tip outlives its notices: a dated closure goes stale in the seed.
  it("carries no dated notice in any tip", () => {
    const dated = [...byId.values()].filter((p) => /\b20\d\d\b/.test(p.tip ?? "")).map((p) => p.id);
    expect(dated).toEqual([]);
  });

  it("gives Enoshima the official pass price and its Enoden walk", () => {
    const island = get("kmk-enoshima");
    expect(island.tip).toContain("eno=pass (¥1,100)");
    expect(island.tip).not.toMatch(/island (and [^.]* )?(is|are) free|open at all hours/i);
    expect(island.cost).toBe(0);
    expect(island.opens ?? null).toBeNull();
    expect([island.station, island.walk]).toEqual(["enoshima", 23]);
    expect(island.sources).toEqual(expect.arrayContaining(["enoshimajinja.or.jp/access/", "fujisawa-kanko.jp/access/ticket.html"]));
  });

  it("puts the aquarium 10 minutes from the Enoden, keeping the Odakyu 3 minutes in the tip", () => {
    const aquarium = get("kmk-enosui");
    expect([aquarium.station, aquarium.walk]).toEqual(["enoshima", 10]);
    expect(aquarium.tip).toContain("Katase-Enoshima Station on the Odakyu line is 3 minutes away");
    expect(aquarium.sources).toContain("enosui.com/access.php");
  });

  it("keeps Marine Tower's hours, price and station", () => {
    const tower = get("ykh-marine-tower");
    expect([tower.opens, tower.closes, tower.cost, tower.closedWeekdays, tower.station, tower.walk]).toEqual([
      "10:00", "22:00", 1000, [], "motomachi-chukagai", 1,
    ]);
  });
});
