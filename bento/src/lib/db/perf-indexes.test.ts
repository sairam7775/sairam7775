/** 0034: indexes for what the app's queries and cascades actually hit, and a
 *  primary key for the write ledger. Read as text: no database runs here. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const code = readFileSync(join(process.cwd(), "supabase/migrations/0034_query_indexes.sql"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/--[^\n]*/g, "");
const flat = code.replace(/\s+/g, " ").trim();

it("indexes bookings.covers_day_id, which deleting a day sets to null", () => {
  expect(flat).toContain("create index if not exists bookings_covers_day_idx on bookings (covers_day_id) where covers_day_id is not null;");
});

it("indexes api_usage by time alone, for the project-wide spend sum", () => {
  expect(flat).toContain("create index if not exists api_usage_created_idx on api_usage (created_at);");
});

it("gives write_usage an identity primary key and changes nothing else about it", () => {
  expect(flat).toContain("alter table write_usage add column id bigint generated always as identity primary key;");
  expect(flat).not.toMatch(/charge_user_writes/);
});

it("adds only those, and drops nothing", () => {
  expect(flat.match(/create index/g)).toHaveLength(2);
  expect(flat).not.toMatch(/\bdrop\b/);
});
