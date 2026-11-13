import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientIp, limiterSubject, takeAuthTokens, type AuthLimitKind } from "../auth-limit";

/** The bucket arithmetic lives in `take_auth_token` (0029). What is tested
 *  here is what the app hands it: which address a request counts against,
 *  that emails and addresses never reach the database in the clear, and
 *  the order and failure rules of the checks. */

const key = Buffer.from("test key");

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("clientIp", () => {
  it("uses the address Vercel puts in x-real-ip", () => {
    expect(clientIp(headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.7");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    expect(clientIp(headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("counts an IPv6 address by its /64, which one person can fill with addresses", () => {
    expect(clientIp(headers({ "x-real-ip": "2001:db8:1:2:3:4:5:6" }))).toBe("2001:db8:1:2::/64");
    expect(clientIp(headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8:0:0::/64");
    expect(clientIp(headers({ "x-real-ip": "2001:DB8:1:2::9" }))).toBe("2001:db8:1:2::/64");
  });

  it("reads an IPv4 address written as IPv6 as the IPv4 address", () => {
    expect(clientIp(headers({ "x-real-ip": "::ffff:203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("puts requests with no address in one shared bucket", () => {
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("limiterSubject", () => {
  it("is a keyed hash, so the database never holds an email or address", () => {
    const s = limiterSubject("traveller@example.com", key);
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(s).not.toContain("traveller");
  });

  it("treats an email the same whatever its case or spacing", () => {
    expect(limiterSubject(" Traveller@Example.com ", key)).toBe(limiterSubject("traveller@example.com", key));
  });

  it("differs under another key", () => {
    expect(limiterSubject("traveller@example.com", key)).not.toBe(limiterSubject("traveller@example.com", Buffer.from("other")));
  });
});

type Call = { kind: string; subject: string };

function stub(answers: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Call[] = [];
  const db = {
    rpc: async (_fn: string, args: { p_kind: string; p_subject: string }) => {
      calls.push({ kind: args.p_kind, subject: args.p_subject });
      return answers[args.p_kind] ?? { data: [{ allowed: true, retry_after_ms: 0 }], error: null };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

const checks: [AuthLimitKind, string][] = [
  ["signin_ip", "203.0.113.7"],
  ["signin_email", "traveller@example.com"],
];

describe("takeAuthTokens", () => {
  it("allows when every bucket has a token, sending only hashes", async () => {
    const { db, calls } = stub({});
    expect(await takeAuthTokens(db, checks, key)).toBe(true);
    expect(calls).toEqual([
      { kind: "signin_ip", subject: limiterSubject("203.0.113.7", key) },
      { kind: "signin_email", subject: limiterSubject("traveller@example.com", key) },
    ]);
  });

  it("refuses at the first empty bucket and spends nothing from the rest", async () => {
    const { db, calls } = stub({ signin_ip: { data: [{ allowed: false, retry_after_ms: 30_000 }], error: null } });
    expect(await takeAuthTokens(db, checks, key)).toBe(false);
    expect(calls.map((c) => c.kind)).toEqual(["signin_ip"]);
  });

  it("refuses when a later bucket is empty", async () => {
    const { db } = stub({ signin_email: { data: { allowed: false, retry_after_ms: 1000 }, error: null } });
    expect(await takeAuthTokens(db, checks, key)).toBe(false);
  });

  it("fails closed when the limiter function is missing, so a skipped migration can't switch it off", async () => {
    const missing = { code: "PGRST202", message: "Could not find the function" };
    const { db } = stub({ signin_ip: { data: null, error: missing } });
    await expect(takeAuthTokens(db, checks, key)).rejects.toEqual(missing);
  });

  it("fails closed on any other database error", async () => {
    const boom = { code: "57014", message: "canceling statement due to statement timeout" };
    const { db } = stub({ signin_ip: { data: null, error: boom } });
    await expect(takeAuthTokens(db, checks, key)).rejects.toEqual(boom);
  });

  it("fails closed on an empty answer", async () => {
    const { db } = stub({ signin_ip: { data: [], error: null } });
    await expect(takeAuthTokens(db, checks, key)).rejects.toThrow(/no row/);
  });
});
