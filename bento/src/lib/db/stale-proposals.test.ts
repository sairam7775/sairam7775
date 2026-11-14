import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("checks snapshots under the shared lock before any proposal writes, closing stale cards without raising", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0031_stale_proposals.sql"), "utf8");
  const apply = sql.slice(sql.indexOf("create or replace function apply_proposal("), sql.indexOf("-- Date proposals"));
  expect(apply).toContain("returns void");
  expect(apply).toContain("security invoker\nset search_path = public");
  expect(apply.indexOf("for update")).toBeLessThan(apply.indexOf("v_day ? 'base'"));
  expect(apply).toContain("is distinct from v_day->'base'");
  expect(apply).toContain("diff_status = 'rejected', resolution_reason = 'stale_day'");
  expect(apply.indexOf("return;")).toBeLessThan(apply.indexOf("perform replace_trip_route"));
  expect(apply).toContain("order by i.sort_order");
  expect(sql).toMatch(/create or replace function replace_day_items[\s\S]*for update/);
  expect(sql).toContain("d - 'base'");
});
