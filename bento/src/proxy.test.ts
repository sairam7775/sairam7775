/** The proxy asks Supabase who the visitor is (getUser, a network call) on
 *  every request it matches, so it must match the app's pages and routes and
 *  skip static files: the mascot animations, the manifest, icons. */
import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "./proxy";

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe("proxy matcher", () => {
  it.each([
    "/",
    "/trips",
    "/trips/0b7e4c1a-1111-4222-8333-944445555666",
    "/trips/plan",
    "/settings",
    "/settings/account",
    "/admin/review",
    "/sign-in",
    "/auth/callback",
    "/api/chat",
    "/api/transit",
    "/api/parse-booking",
    "/shared/0123456789abcdef0123456789abcdef",
    "/privacy",
  ])("runs for the app route %s", (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each([
    "/mascot/full-hello.json",
    "/mascot/head-think.json",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/opengraph-image.png",
    "/icons/icon-192.png",
    "/logo/bento-mark.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75",
    "/ingest/e/",
  ])("skips the static file %s", (url) => {
    expect(matches(url)).toBe(false);
  });
});
