import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/csp-report", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a report and logs only the directive and blocked origin", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const privateUrl = "https://blocked.example/assets.js?share=secret-token";
    const request = new Request("https://bento.test/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify([
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "script-src-elem",
            blockedURL: privateUrl,
            documentURL: "https://bento.test/shared/private-token",
          },
        },
      ]),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledExactlyOnceWith("CSP violation", {
      directive: "script-src-elem",
      blockedOrigin: "https://blocked.example",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-token");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-token");
  });

  it("logs at most a few reports from one request, however many it carries", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const many = Array.from({ length: 500 }, () => ({ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://x.example/a.png" } }));
    const response = await POST(new Request("https://bento.test/api/csp-report", { method: "POST", body: JSON.stringify(many) }));
    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(5);
  });

  it("accepts legacy CSP reports", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new Request("https://bento.test/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "violated-directive": "img-src",
          "blocked-uri": "data:image/png;base64,private-data",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledExactlyOnceWith("CSP violation", {
      directive: "img-src",
      blockedOrigin: null,
    });
  });

  it("rejects a report larger than 64 KB", async () => {
    const request = new Request("https://bento.test/api/csp-report", {
      method: "POST",
      body: "x".repeat(64 * 1024 + 1),
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
  });
});
