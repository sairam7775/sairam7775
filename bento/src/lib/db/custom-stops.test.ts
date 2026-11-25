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
    // F8: a NULL length would pass a bare "between", so it is required.
    expect(squash(sql)).toContain("check (custom_name is null or (duration_min is not null and duration_min between 5 and 720))");
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

  it("apply_proposal is 0031's with only its base query moved into day_base", () => {
    const m31 = read("0031_stale_proposals.sql");
    const start = m31.indexOf("create function apply_proposal(");
    const before = m31.slice(start, m31.indexOf("$$;", m31.indexOf("as $$", start) + 5) + 3).replace("create function apply_proposal(", "create or replace function apply_proposal(");
    const a = before.indexOf("      select coalesce(jsonb_agg(jsonb_build_object(");
    const mark = "where d.trip_id = p_trip and d.date = (v_day->>'date')::date;";
    const expected = before.slice(0, a) + "v_base := day_base(p_trip, (v_day->>'date')::date);" + before.slice(before.indexOf(mark, a) + mark.length);
    expect(a).toBeGreaterThan(-1);
    expect(squash(fn(sql, "apply_proposal"))).toBe(squash(expected));
  });

  it("day_base is 0031's base plus a free-text stop's name, in dayBase's total order", () => {
    const at = sql.indexOf("create or replace function day_base(");
    const base = squash(sql.slice(at, sql.indexOf("$$;", sql.indexOf("as $$", at) + 5)));
    expect(base).toContain("|| case when i.custom_name is not null then jsonb_build_object('customName', i.custom_name) else '{}'::jsonb end");
    expect(base).toContain(
      `order by i.sort_order, i.place_id collate "C" nulls last, i.custom_name collate "C" nulls last, ` +
      `(extract(hour from i.start_time) * 60 + extract(minute from i.start_time))::int nulls last, i.duration_min nulls last, i.locked, ` +
      `i.arrive_mode collate "C" nulls last, i.arrive_minutes nulls last, i.arrive_detail collate "C" nulls last)`,
    );
    expect(base).toContain("security invoker set search_path = public");
  });

  it("replace_day_items_checked compares under the trip lock, before writing", () => {
    const checked = squash(fn(sql, "replace_day_items_checked"));
    expect(checked).toContain("security invoker set search_path = public");
    const lock = checked.indexOf("perform 1 from trips where id = p_trip for update;");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(checked.indexOf("day_base(p_trip, p_date) is distinct from"));
    expect(checked.indexOf("return 'stale_day';")).toBeLessThan(checked.indexOf("perform replace_day_items("));
  });

  it("the new functions are for authenticated and service_role, never anon; no new definer function", () => {
    for (const sig of ["day_base(uuid, date)", "replace_day_items_checked(uuid, date, text, jsonb, jsonb)"]) {
      expect(sql).toContain(`revoke all on function ${sig} from public, anon;`);
      expect(sql).toContain(`grant execute on function ${sig} to authenticated, service_role;`);
    }
    // shared_trip is the one definer function, as it was.
    expect(sql.match(/^security definer$/gim)).toHaveLength(1);
  });
});
