import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase", "migrations");
const read = (file: string) => readFileSync(join(migrations, file), "utf8");
const withoutComments = (sql: string) => sql.replace(/--[^\r\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
const signature = String.raw`renew_trip_share\(\s*uuid\s*,\s*timestamptz\s*,\s*boolean\s*\)`;

describe("renew_trip_share (0030)", () => {
  const sql = withoutComments(read("0030_renew_trip_share.sql"));
  const header = /create\s+or\s+replace\s+function\s+(?:public\.)?renew_trip_share\s*\(([\s\S]*?)\)\s*returns\s+text([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$/i.exec(sql);

  it("is one function returning the new token", () => {
    expect(header).not.toBeNull();
    expect(header![1].replace(/\s+/g, " ").trim()).toBe("p_trip uuid, p_expires_at timestamptz, p_until_trip_end boolean");
  });

  it("runs with the caller's rights, so RLS and the column grants stay the guard", () => {
    expect(header![2]).toMatch(/\bsecurity\s+invoker\b/i);
    expect(sql).not.toMatch(/\bsecurity\s+definer\b/i);
    expect(header![2]).toMatch(/\bset\s+search_path\s*=\s*public\s*,\s*pg_temp\b/i);
  });

  it("is closed to anon and the public, open to signed-in travellers only", () => {
    expect(sql).toMatch(new RegExp(String.raw`revoke\s+all\s+on\s+function\s+(?:public\.)?${signature}\s+from\s+public\s*,\s*anon\s*;`, "i"));
    expect(sql).toMatch(new RegExp(String.raw`grant\s+execute\s+on\s+function\s+(?:public\.)?${signature}\s+to\s+authenticated\s*;`, "i"));
    expect(sql).not.toMatch(/grant\s+execute[^;]*\bto\b[^;]*\b(?:anon|public)\b/i);
  });

  it("serialises renews of one trip and checks ownership first", () => {
    const body = header![3];
    // The owned trip's row lock first, as apply_proposal takes it: renews of
    // one trip queue on it, and a trip deletion (trip, then its share) can't
    // meet a renew (share, then trip) in the opposite order.
    const tripLock = /from\s+trips\s+where\s+id\s*=\s*p_trip\s+and\s+user_id\s*=\s*\(\s*select\s+auth\.uid\(\)\s*\)\s+for\s+update\b/i;
    expect(body).toMatch(tripLock);
    expect(body.search(tripLock)).toBeLessThan(body.search(/\bdelete\s+from\s+trip_shares\b/i));
    expect(body).not.toMatch(/pg_advisory/i);
    // No handler: a failed insert must roll the delete back, never be swallowed.
    expect(body).not.toMatch(/\bexception\s+when\b/i);
    // The token still comes from the column default: the function never names it on write.
    expect(body).not.toMatch(/\bupdate\s+trip_shares\b/i);
    expect(body).toMatch(/insert\s+into\s+trip_shares\s*\(\s*trip_id\s*,\s*expires_at\s*,\s*until_trip_end\s*\)/i);
  });

  it("re-checks until the trip ends under the lock, by shared_trip()'s own rule", () => {
    const body = header![3];
    // The rule shared_trip() uses (0024, unchanged in 0026) to decide such a link still opens.
    const rule = "now() < (tr.end_date + 1)::timestamp at time zone 'UTC'";
    expect(withoutComments(read("0026_hours_vary.sql"))).toContain(`tr.end_date is not null and ${rule}`);
    expect(body).toContain(`p_until_trip_end and not (tr.end_date is not null and ${rule})`);
    expect(body.search(/p_until_trip_end\s+and\s+not/i)).toBeLessThan(body.search(/\bdelete\s+from\s+trip_shares\b/i));
  });

  it("never gives travellers a way to write a token", () => {
    for (const file of readdirSync(migrations).filter((name) => /^\d{4}_.*\.sql$/.test(name))) {
      const text = withoutComments(read(file));
      expect(text, file).not.toMatch(/grant\s+(?:update|insert)\s*\([^)]*\btoken\b[^)]*\)\s+on\s+trip_shares/i);
      expect(text, file).not.toMatch(/grant\s+(?:all|update)\b[^;(]*\bon\s+(?:table\s+)?trip_shares\b/i);
    }
  });
});
