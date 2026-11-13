import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  it("includes the policy directives for Bento's local assets and forms", () => {
    const policy = buildCsp({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: false,
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' https://project.supabase.co");
    expect(policy).toContain("img-src 'self' data:");
    expect(policy).toContain("font-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    // Google sign-in before hydration: a real form post, redirected to Supabase
    // auth and on to Google, and form-action covers each hop.
    expect(policy).toContain("form-action 'self' https://project.supabase.co https://accounts.google.com");
    expect(policy).toContain("report-uri /api/csp-report");
  });

  it("uses only the Supabase origin, with or without a trailing slash", () => {
    const withoutSlash = buildCsp({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: false,
    });
    const withSlash = buildCsp({
      supabaseUrl: "https://project.supabase.co/",
      isDevelopment: false,
    });

    expect(withSlash).toBe(withoutSlash);
    expect(withSlash).toContain("connect-src 'self' https://project.supabase.co;");
  });

  it("allows unsafe-eval only in development", () => {
    const development = buildCsp({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: true,
    });
    const production = buildCsp({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: false,
    });

    expect(development).toContain("'unsafe-eval'");
    expect(production).not.toContain("'unsafe-eval'");
  });

  it("is enforced on every page, not only reported", async () => {
    const [{ source, headers }] = await nextConfig.headers!();
    expect(source).toBe("/:path*");
    const csp = headers.filter((h) => h.key.toLowerCase().startsWith("content-security-policy"));
    expect(csp.map((h) => h.key)).toEqual(["Content-Security-Policy"]);
    expect(csp[0].value).toContain("script-src");
    expect(csp[0].value).toContain("frame-ancestors 'none'");
  });
});
