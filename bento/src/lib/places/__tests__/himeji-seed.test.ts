import { describe, expect, it } from "vitest";
import { himeji } from "../seed/himeji";

const byId = new Map(himeji.map((p) => [p.id, p]));
const get = (id: string) => {
  const p = byId.get(id);
  if (!p) throw new Error(`no place ${id}`);
  return p;
};

describe("Himeji drafts", () => {
  // An outline city needs 8 verified places; the owner signs off the drafts.
  it("has enough drafts for Himeji to reach outline", () => {
    expect(himeji.length).toBeGreaterThanOrEqual(8);
  });

  it("carries no dated notice in any tip", () => {
    expect(himeji.filter((p) => /\b20\d\d\b/.test(p.tip)).map((p) => p.id)).toEqual([]);
  });

  it("keeps the Museum of Literature's published hours, closing day and price", () => {
    const m = get("hmj-literature-museum");
    expect([m.opens, m.closes, m.closedWeekdays, m.cost]).toEqual(["10:00", "17:00", [1], 450]);
    expect(m.sources).toContain("himejibungakukan.jp/riyou/");
  });

  it("gives Otokoyama, reached by bus, no station and no price", () => {
    const o = get("hmj-otokoyama");
    expect([o.station, o.walk, o.cost]).toEqual([null, null, 0]);
    expect(o.tip).toContain("198");
  });
});
