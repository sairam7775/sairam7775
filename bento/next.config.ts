import type { NextConfig } from "next";

/** Security headers live here rather than in vercel.json so they apply in
 *  development and on any host, not just one. They matter more than usual
 *  because these pages render booking references (§15).
 *
 *  Vercel-specific settings — which region the functions run in — are the
 *  only thing in vercel.json. */
const securityHeaders = [
  // A page showing a PNR must not be frameable by anyone.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak a trip id or a reveal parameter to another origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
