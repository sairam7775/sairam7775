/** 0036: free-text stops. Read as SQL text, like the other migration
 *  tests here: no Postgres runs in this suite. Each recreated function must
 *  be its previous version plus only the change named. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n");
const sql = read("0036_custom_stops.sql");

/** The function `name`'s whole definition, from `create or replace` to `$$;`. */
function fn(text: string, name: string): string {
  const start = text.indexOf(`create or replace function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const body = text.indexOf("as $$", start);
  return text.slice(start, text.indexOf("$$;", body + 5) + 3);
}
const squash = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

describe("0036 custom stops", () => {
  it("adds custom_name with checks: bounded, one kind of stop, a length always", () => {
    expect(sql).toMatch(/alter table itinerary_items\s+add column custom_name text;/);
    expect(squash(sql)).toContain("char_length(custom_name) between 1 and 80");
    expect(squash(sql)).toContain("add constraint itinerary_items_one_kind check (custom_name is null or place_id is null)");
    expect(squash(sql)).toContain("check (custom_name is null or duration_min between 5 and 720)");
    expect(squash(sql)).toContain("check (place_id is not null or custom_name is not null) not valid");
    expect(sql).toContain("custom_name !~ '[[:cntrl:]]'");
  });

  it("replace_day_items is 0031's, writing custom_name and an empty place_id as null", () => {
    const before = squash(fn(read("0031_stale_proposals.sql"), "replace_day_items"));
    const after = squash(fn(sql, "replace_day_items"));
    const expected = before
      .replace("insert into itinerary_items (day_id, place_id, sort_order,", "insert into itinerary_items (day_id, place_id, custom_name, sort_order,")
      .replace("v_day, i->>'place_id', (i->>'sort_order')::int", "v_day, nullif(i->>'place_id', ''), nullif(i->>'custom_name', ''), (i->>'sort_order')::int");
    expect(expected).not.toBe(before);
    expect(after).toBe(expected);
    // Still the traveller's own rights and the trip lock first.
    expect(after).toContain("security invoker set search_path = public");
    expect(after.indexOf("for update")).toBeLessThan(after.indexOf("delete from itinerary_items"));
  });

  it("shared_trip is 0026's, plus custom_name on each stop and nothing else", () => {
    const before = squash(fn(read("0026_hours_vary.sql"), "shared_trip"));
    const after = squash(fn(sql, "shared_trip"));
    expect(after).toBe(before.replace("'place_id', i.place_id, 'sort_order'", "'place_id', i.place_id, 'custom_name', i.custom_name, 'sort_order'"));
    expect(after).toContain("security definer set search_path = public, pg_temp");
  });

  it("trip_reviews_plan is 0019's, naming a free-text stop", () => {
    const before = squash(fn(read("0019_trip_reviews.sql"), "trip_reviews_plan"));
    const after = squash(fn(sql, "trip_reviews_plan"));
    expect(after).toBe(before.replace("coalesce(p.name, i.place_id, '?')", "coalesce(p.name, i.custom_name, i.place_id, '?')"));
  });

  it("leaves apply_proposal alone and grants nothing new", () => {
    expect(sql).not.toMatch(/function apply_proposal/);
    expect(sql).not.toMatch(/\bgrant\b/i);
    // shared_trip is the one definer function, as it was.
    expect(sql.match(/^security definer$/gim)).toHaveLength(1);
  });
});
