/** The Content Security Policy, sent as report-only for now
 *  (`Content-Security-Policy-Report-Only` in next.config.ts), so a gap shows
 *  up in /api/csp-report before anything is blocked. It allows exactly what
 *  Bento loads: its own pages, scripts, fonts and Lottie files, PostHog
 *  through this site's /ingest rewrite, and Supabase. A new third-party
 *  origin goes here once the app really uses it. */
type CspOptions = {
  supabaseUrl?: string;
  isDevelopment: boolean;
};

export function buildCspReportOnly({ supabaseUrl, isDevelopment }: CspOptions): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const supabase = supabaseOrigin ? [supabaseOrigin] : [];
  const scriptSources = ["'self'", "'unsafe-inline'"];

  // React uses eval for its enhanced error stacks in development only.
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  // Next writes inline runtime scripts and styles. Per-request nonces through
  // Proxy are the next step before either unsafe-inline entry can be removed.
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${["'self'", ...supabase].join(" ")}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    // Google sign-in posts to a server action that redirects to Supabase
    // auth; before hydration that is a real form submission and its redirect.
    `form-action ${["'self'", ...supabase].join(" ")}`,
    // upgrade-insecure-requests waits for the enforced policy: browsers
    // ignore it in a report-only one and warn on every page.
    "report-uri /api/csp-report",
  ];

  return directives.join("; ");
}
