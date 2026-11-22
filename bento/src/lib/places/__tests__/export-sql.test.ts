/** The place exporter (scripts/export-places-seed.ts) writes what the seeds
 *  say, including closures that come every year, and refuses a malformed one. */
import { describe, expect, it } from "vitest";
import { allPlaces } from "../seed";
import { osaka } from "../seed/osaka";
import { placesSeedSql } from "../export-sql";
import { isYearlyRange } from "@/lib/engine/closures";

// Alone in a batch, so without its link to the park.
const castle = { ...osaka.find((p) => p.id === "osk-osaka-castle")!, pairs: [] };

describe("placesSeedSql", () => {
  it("writes closed_yearly as a text array, and an empty one for places without", () => {
    const sql = placesSeedSql([castle, { ...castle, id: "osk-test-open", closedYearly: undefined }]);
    expect(sql).toMatch(/insert into places \([^)]*\bclosed_weekdays, closed_yearly\b/);
    expect(sql).toMatch(/\('osk-osaka-castle', [^\n]*array\['12-28\.\.01-01'\]::text\[\]/);
    expect(sql).toMatch(/\('osk-test-open', [^\n]*array\[\]::int\[\], array\[\]::text\[\]/);
    expect(sql).toContain("closed_yearly = excluded.closed_yearly");
    expect(sql).toContain("where places.verification_status = 'draft';");
  });

  it("writes evening_only, false unless the seed sets it", () => {
    const sql = placesSeedSql([castle, { ...castle, id: "osk-test-night", eveningOnly: true }]);
    expect(sql).toMatch(/insert into places \([^)]*\bclosed_yearly, evening_only\b/);
    expect(sql).toMatch(/\('osk-osaka-castle', [^\n]*array\['12-28\.\.01-01'\]::text\[\], false,/);
    expect(sql).toMatch(/\('osk-test-night', [^\n]*::text\[\], true,/);
    expect(sql).toContain("evening_only = excluded.evening_only");
  });

  it("refuses a closure that isn't MM-DD or MM-DD..MM-DD", () => {
    expect(() => placesSeedSql([{ ...castle, closedYearly: ["28 Dec - 1 Jan"] }])).toThrow(/osk-osaka-castle closed_yearly/);
    expect(() => placesSeedSql([{ ...castle, closedYearly: ["2026-12-28..2027-01-01"] }])).toThrow(/closed_yearly/);
  });

  it("still refuses duplicate ids and dangling links", () => {
    expect(() => placesSeedSql([castle, castle])).toThrow(/duplicate place id/);
    expect(() => placesSeedSql([{ ...castle, pairs: ["nope"] }])).toThrow(/pairs_with unknown nope/);
  });

  it("every seed's closures are well formed", () => {
    for (const p of allPlaces) for (const r of p.closedYearly ?? []) expect(isYearlyRange(r), `${p.id} ${r}`).toBe(true);
    expect(() => placesSeedSql(allPlaces)).not.toThrow();
  });
});
