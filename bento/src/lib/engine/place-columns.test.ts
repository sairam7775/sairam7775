/** The traveller-facing place loaders name their columns instead of
 *  select("*"): PLACE_COLUMNS is exactly what rowToPlace reads, so the two
 *  can't drift, and every name is a column places_public has (an unknown
 *  name would fail the whole request). The same for the preferences row. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACE_COLUMNS, rowToPlace } from "@/lib/engine/load";
import { PREF_COLUMNS, prefsFromRow } from "@/lib/bento-man/prefs-row";

/** The keys a mapper reads from a row, recorded through a proxy. */
function keysRead(map: (row: Record<string, unknown>) => unknown): string[] {
  const seen = new Set<string>();
  const row = new Proxy({} as Record<string, unknown>, {
    get(_t, k) {
      if (typeof k === "string") seen.add(k);
      return undefined;
    },
  });
  map(row);
  return [...seen].sort();
}

const columns = (list: string) => list.split(",").map((c) => c.trim()).sort();
const migrations = join(process.cwd(), "supabase/migrations");
const strip = (s: string) => s.replace(/--[^\n]*/g, "");

describe("places_public column list", () => {
  it("is exactly the columns rowToPlace reads", () => {
    expect(columns(PLACE_COLUMNS)).toEqual(keysRead((r) => rowToPlace(r, "deep")));
  });

  it("names only columns of the latest places_public", () => {
    const sql = strip(readFileSync(join(migrations, "0033_evening_only.sql"), "utf8"));
    const view = sql.slice(sql.indexOf("create or replace view places_public"), sql.indexOf("from places p;"));
    const select = view.slice(view.indexOf("select") + "select".length);
    const viewColumns = select.split(",").map((c) => {
      const s = c.trim();
      const as = s.match(/ as (\w+)\s*$/);
      return as ? as[1] : s.replace(/^p\./, "").replace(/\s*end$/, "");
    });
    for (const c of columns(PLACE_COLUMNS)) expect(viewColumns).toContain(c);
    // What the list leaves out: provenance the planner never reads.
    expect(viewColumns.filter((c) => !columns(PLACE_COLUMNS).includes(c)).sort()).toEqual(["last_verified", "sources"]);
  });

  it("is what the traveller-facing loaders select, never *", () => {
    for (const f of ["src/lib/engine/load.ts", "src/lib/bento-man/store.supabase.ts", "src/lib/trips/ready-made/catalogue.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/from\("places_public"\)\.select\("\*"/);
      expect(src, f).toContain("PLACE_COLUMNS");
    }
  });
});

describe("user_preferences column list", () => {
  it("is exactly the columns the trip state reads", () => {
    expect(columns(PREF_COLUMNS)).toEqual(keysRead((r) => prefsFromRow(r)));
  });

  it("is what Bento Man's store selects, never *", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/bento-man/store.supabase.ts"), "utf8");
    expect(src).not.toMatch(/from\("user_preferences"\)\.select\("\*"/);
    expect(src).toContain("select(PREF_COLUMNS)");
  });
});
