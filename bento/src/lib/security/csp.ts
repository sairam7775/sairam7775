/** The Content Security Policy, enforced (next.config.ts): anything it
 *  doesn't list is blocked, and reported to /api/csp-report. It allows
 *  exactly what Bento loads: its own pages, scripts, fonts and Lottie files,
 *  PostHog through this site's /ingest rewrite, and Supabase. A new
 *  third-party origin goes here once the app really uses it — check the
 *  page with the policy on, or production will block it. */
type CspOptions = {
  supabaseUrl?: string;
  isDevelopment: boolean;
};

export function buildCsp({ supabaseUrl, isDevelopment }: CspOptions): string {
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
    // auth, which redirects to Google; before hydration that is a real form
    // submission, and browsers check form-action on every redirect after it.
    `form-action ${["'self'", ...supabase, "https://accounts.google.com"].join(" ")}`,
    // No upgrade-insecure-requests: every source here is this site or
    // https already, HSTS keeps the site itself on https, and it would
    // break the production build served on http://localhost.
    "report-uri /api/csp-report",
  ];

  return directives.join("; ");
}
