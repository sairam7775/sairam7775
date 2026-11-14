import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const dir = join(process.cwd(), "supabase/migrations");
const sql = readFileSync(join(dir, "0031_stale_proposals.sql"), "utf8");
const SIG = "apply_proposal(uuid, uuid, jsonb, jsonb, date, date)";

it("checks snapshots under the shared lock before any proposal writes, returning the stale outcome so the close commits", () => {
  const apply = sql.slice(sql.indexOf("create function apply_proposal("), sql.indexOf("-- Date proposals"));
  expect(apply).toContain("returns text");
  expect(apply).toContain("security invoker\nset search_path = public");
  expect(apply.indexOf("for update")).toBeLessThan(apply.indexOf("v_day ? 'base'"));
  expect(apply).toContain("is distinct from v_day->'base'");
  expect(apply).toContain("set diff_status = 'rejected', resolved_at = now()");
  expect(apply.indexOf("return 'stale_day';")).toBeLessThan(apply.indexOf("perform replace_trip_route"));
  expect(apply).toMatch(/return 'applied';\s*end;/);
  expect(apply).toContain("order by i.sort_order");
  expect(sql).toMatch(/create or replace function replace_day_items[\s\S]*for update/);
  expect(sql).toContain("d - 'base'");
});

it("needs no schema change", () => {
  expect(sql).not.toMatch(/resolution_reason|alter table/i);
});

it("recreates apply_proposal with the grants it had: authenticated and service_role, never anon", () => {
  const drop = sql.indexOf(`drop function if exists ${SIG};`);
  const create = sql.indexOf("create function apply_proposal(");
  expect(drop).toBeGreaterThan(-1);
  expect(drop).toBeLessThan(create);
  const grants = sql.slice(create);
  expect(grants).toContain(`revoke all on function ${SIG} from public, anon;`);
  expect(grants).toContain(`grant execute on function ${SIG} to authenticated, service_role;`);
});

it("no migration grants anon execute on a function other than the shared-trip reader", () => {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql"))) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const [stmt] of text.matchAll(/grant\s+execute\s+on\s+function\s+[^;]+;/gi)) {
      const grantees = stmt.split(/\bto\b/i).pop()!;
      if (/\b(anon|public)\b/i.test(grantees)) expect(stmt, f).toMatch(/function\s+shared_trip\(text\)/i);
    }
  }
});
