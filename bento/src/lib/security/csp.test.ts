import { describe, expect, it } from "vitest";
import { buildCspReportOnly } from "./csp";

describe("buildCspReportOnly", () => {
  it("includes the policy directives for Bento's local assets and forms", () => {
    const policy = buildCspReportOnly({
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
    // Google sign-in posts to a server action that redirects to Supabase auth.
    expect(policy).toContain("form-action 'self' https://project.supabase.co");
    // Browsers ignore it in a report-only policy and warn on every page.
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).toContain("report-uri /api/csp-report");
  });

  it("uses only the Supabase origin, with or without a trailing slash", () => {
    const withoutSlash = buildCspReportOnly({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: false,
    });
    const withSlash = buildCspReportOnly({
      supabaseUrl: "https://project.supabase.co/",
      isDevelopment: false,
    });

    expect(withSlash).toBe(withoutSlash);
    expect(withSlash).toContain("connect-src 'self' https://project.supabase.co;");
  });

  it("allows unsafe-eval only in development", () => {
    const development = buildCspReportOnly({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: true,
    });
    const production = buildCspReportOnly({
      supabaseUrl: "https://project.supabase.co",
      isDevelopment: false,
    });

    expect(development).toContain("'unsafe-eval'");
    expect(production).not.toContain("'unsafe-eval'");
  });
});
