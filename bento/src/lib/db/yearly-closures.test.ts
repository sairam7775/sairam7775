/** 0032: closures that come every year. The migration adds the column, keeps
 *  places_public read-only while adding it there, and sets the closures on
 *  rows the draft-only seed upsert can't reach (verified ones), with the same
 *  values as the seeds. Read as text: no database runs here. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { allPlaces } from "@/lib/places/seed";

const dir = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n");
const sql = read("0032_yearly_closures.sql");
const code = sql.replace(/--[^\n]*/g, "");
const flat = code.replace(/\s+/g, " ");

it("adds closed_yearly as a non-null text array with a format check", () => {
  expect(flat).toContain("alter table places add column closed_yearly text[] not null default '{}'");
  expect(flat).toMatch(/constraint places_closed_yearly_format check/);
  // Per element: an element holding a comma can't pass as two.
  expect(flat).toContain("cardinality(regexp_split_to_array(array_to_string(closed_yearly, ','), ',')) = cardinality(closed_yearly)");
});

it("adds closed_yearly to places_public after every column 0026 had, and locks the view again", () => {
  const view = (s: string) => s.slice(s.indexOf("create or replace view places_public"), s.indexOf("from places p;"));
  const before = view(read("0026_hours_vary.sql").replace(/--[^\n]*/g, "")).replace(/\s+/g, " ").trim();
  const after = view(code).replace(/\s+/g, " ").trim();
  expect(after).toBe(`${before}, p.closed_yearly`);
  expect(flat).toContain("revoke insert, update, delete, truncate, references, trigger on public.places_public from anon, authenticated;");
});

it("sets every seed place's closures by id, verified rows included, with the seed's values", () => {
  const updates = [...code.matchAll(/update places set closed_yearly = array\[([^\]]*)\]::text\[\] where id = '([^']+)';/g)]
    .map(([, list, id]) => [id, list.split(",").map((s) => s.trim().replace(/^'|'$/g, ""))] as const);
  const seeded = allPlaces.filter((p) => p.closedYearly?.length).map((p) => [p.id, p.closedYearly!] as const);
  expect(new Map(updates)).toEqual(new Map(seeded));
  expect(seeded.length).toBeGreaterThan(0);
  // By id alone: a status filter would skip exactly the rows that need it.
  expect(code).not.toMatch(/update places set closed_yearly[^;]*verification_status/);
});
