/** 0033: places that are only worth visiting in the evening, as an explicit
 *  flag (the owner's call: never inferred from a best window). The
 *  migration adds the column, keeps places_public read-only while adding it
 *  there, and sets the flag on rows the draft-only seed upsert can't reach
 *  (verified ones), with the seeds' values. Read as text: no database runs
 *  here. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { allPlaces } from "@/lib/places/seed";
import { rowToPlace } from "@/lib/engine/load";

const dir = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n");
const code = read("0033_evening_only.sql").replace(/--[^\n]*/g, "");
const flat = code.replace(/\s+/g, " ");

it("adds evening_only as a non-null boolean, false unless set", () => {
  expect(flat).toContain("alter table places add column evening_only boolean not null default false");
});

it("adds evening_only to places_public after every column 0032 had, and locks the view again", () => {
  const view = (s: string) => s.slice(s.indexOf("create or replace view places_public"), s.indexOf("from places p;"));
  const before = view(read("0032_yearly_closures.sql").replace(/--[^\n]*/g, "")).replace(/\s+/g, " ").trim();
  const after = view(code).replace(/\s+/g, " ").trim();
  expect(after).toBe(`${before}, p.evening_only`);
  expect(flat).toContain("revoke insert, update, delete, truncate, references, trigger on public.places_public from anon, authenticated;");
});

it("sets the flag by id on exactly the seed places that carry it, verified rows included", () => {
  const updates = [...code.matchAll(/update places set evening_only = true where id = '([^']+)';/g)].map(([, id]) => id).sort();
  const seeded = allPlaces.filter((p) => p.eveningOnly).map((p) => p.id).sort();
  expect(updates).toEqual(seeded);
  // Only places whose own notes say they are dead or closed by day.
  expect(seeded).toEqual(["hir-kagura", "hir-nagarekawa", "hir-ogonzan", "kyt-pontocho", "osk-teamlab-botanical", "tky-golden-gai"]);
  expect(code).not.toMatch(/update places set evening_only[^;]*verification_status/);
});

it("reads the flag from places_public, and false from a view without the column", () => {
  const row = { id: "x", city_id: "kyoto-city", name: "X", category: "street" };
  expect(rowToPlace({ ...row, evening_only: true }, "deep").eveningOnly).toBe(true);
  expect(rowToPlace(row, "deep").eveningOnly).toBe(false);
});
