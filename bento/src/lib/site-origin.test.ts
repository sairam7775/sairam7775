import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin";

const headers = (h: Record<string, string>) => new Headers(h);

describe("siteOrigin", () => {
  it("prefers the configured address, without a trailing slash", () => {
    expect(siteOrigin(headers({ host: "preview.vercel.app" }), "https://bento.example/")).toBe("https://bento.example");
  });

  it("falls back to the request's host and protocol", () => {
    expect(siteOrigin(headers({ host: "bento.example", "x-forwarded-proto": "https" }), undefined)).toBe("https://bento.example");
    expect(siteOrigin(headers({ host: "localhost:3000" }), "")).toBe("http://localhost:3000");
  });
});
