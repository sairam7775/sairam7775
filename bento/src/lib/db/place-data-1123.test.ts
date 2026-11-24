/** 0035: the read-through of 23 Nov 2026. The seed upsert reaches drafts
 *  only, so every value it sets on these (verified) rows is checked here
 *  against the seeds: the two can't drift. Read as text: no database runs. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { allPlaces } from "@/lib/places/seed";
import { stations, edges } from "@/lib/transit/seed";
import { rowToPlace } from "@/lib/engine/load";

const dir = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n");
const code = read("0035_place_data_1123.sql").replace(/--[^\n]*/g, "");
const flat = code.replace(/\s+/g, " ");
const seed = (id: string) => allPlaces.find((p) => p.id === id)!;
const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;

it("adds many_closed_weekdays as a non-null int array, empty unless set", () => {
  expect(flat).toContain("alter table places add column many_closed_weekdays int[] not null default '{}'");
});

it("adds it to places_public after every column 0033 had, and locks the view again", () => {
  const view = (s: string) => s.slice(s.indexOf("create or replace view places_public"), s.indexOf("from places p;"));
  const before = view(read("0033_evening_only.sql").replace(/--[^\n]*/g, "")).replace(/\s+/g, " ").trim();
  expect(view(code).replace(/\s+/g, " ").trim()).toBe(`${before}, p.many_closed_weekdays`);
  expect(flat).toContain("revoke insert, update, delete, truncate, references, trigger on public.places_public from anon, authenticated;");
});

it("sets many_closed_weekdays on exactly the seed places that carry it", () => {
  const set = [...code.matchAll(/update places set many_closed_weekdays = '\{([\d,]*)\}' where id = '([^']+)';/g)].map(([, days, id]) => [id, days]);
  const seeded = allPlaces.filter((p) => p.manyClosedWeekdays?.length).map((p) => [p.id, p.manyClosedWeekdays!.join(",")]);
  expect(set).toEqual(seeded);
  expect(seeded).toEqual([["tky-tsukiji-outer", "0,3"]]);
});

it("writes each changed tip exactly as the seed has it", () => {
  for (const id of ["tky-omoide-yokocho", "osk-osaka-castle", "kmk-kuzuharaoka"]) {
    expect(code, id).toContain(`local_tip = ${sqlText(seed(id).tip)}`);
  }
});

it("gives Fudoin the seed's station, walk, position and sources, after the station exists", () => {
  const f = seed("hir-fudoin");
  expect(f.station).toBe("fudoin-mae");
  expect(flat).toContain(`nearest_station = '${f.station}', station_walk_min = ${f.walk}`);
  expect(flat).toContain(`ST_MakePoint(${f.lon}, ${f.lat})`);
  expect(flat).toContain(`sources = array[${f.sources.map(sqlText).join(", ")}]::text[] where id = 'hir-fudoin'`);
  const st = stations.find((s) => s.id === "fudoin-mae")!;
  expect(flat).toContain(`('fudoin-mae', 'Fudoin-mae', '不動院前', 'hiroshima-city', extensions.ST_SetSRID(extensions.ST_MakePoint(${st.lon}, ${st.lat})`);
  for (const e of edges.filter((x) => x.line === "Astram Line"))
    expect(flat).toContain(`('${e.from}', '${e.to}', 'Astram Line', 'rail', 'astram', ${e.km}, ${e.minutes}, ${e.fareJpy}, ${e.stops}, null)`);
  expect(code.indexOf("insert into stations")).toBeLessThan(code.indexOf("nearest_station = 'fudoin-mae'"));
});

it("reads the weekdays from places_public, and none from a view without the column", () => {
  const row = { id: "x", city_id: "tokyo-city", name: "X", category: "market" };
  expect(rowToPlace({ ...row, many_closed_weekdays: [0, 3] }, "deep").manyClosedWeekdays).toEqual([0, 3]);
  expect(rowToPlace(row, "deep").manyClosedWeekdays).toEqual([]);
});
