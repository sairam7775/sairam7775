import { describe, expect, it, vi } from "vitest";
import { readJsonLimited } from "./read-json";

function streamRequest(chunks: string[], headers?: HeadersInit, cancel = vi.fn()) {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
    cancel,
  }, { highWaterMark: 0 });
  const init = {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit & { duplex: "half" };
  return { req: new Request("http://localhost", init), cancel };
}

describe("readJsonLimited", () => {
  it("reads a body under the limit", async () => {
    const result = await readJsonLimited(new Request("http://localhost", { method: "POST", body: "{\"ok\":true}" }), 20);
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  it("accepts a body exactly at the limit", async () => {
    const result = await readJsonLimited(new Request("http://localhost", { method: "POST", body: "null   " }), 7);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("refuses one byte over when Content-Length is too large", async () => {
    const result = await readJsonLimited(new Request("http://localhost", {
      method: "POST",
      body: "null    ",
      headers: { "Content-Length": "8" },
    }), 7);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("does not read a body when Content-Length already exceeds the limit", async () => {
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 });
    const init = {
      method: "POST",
      body,
      headers: { "Content-Length": "8" },
      duplex: "half",
    } as RequestInit & { duplex: "half" };
    const result = await readJsonLimited(new Request("http://localhost", init), 7);

    expect(result).toEqual({ ok: false, reason: "too-large" });
    expect(pull).not.toHaveBeenCalled();
  });

  it.each([
    ["without Content-Length", undefined],
    ["with a false Content-Length", { "Content-Length": "4" }],
  ])("cancels an over-long stream %s", async (_label, headers) => {
    const cancel = vi.fn();
    const { req } = streamRequest(["null", "    ", "unread"], headers, cancel);
    const result = await readJsonLimited(req, 7);
    expect(result).toEqual({ ok: false, reason: "too-large" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects invalid JSON", async () => {
    const result = await readJsonLimited(new Request("http://localhost", { method: "POST", body: "{" }), 10);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an empty body", async () => {
    const result = await readJsonLimited(new Request("http://localhost", { method: "POST" }), 10);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("counts multibyte UTF-8 bytes rather than characters", async () => {
    const body = "{\"text\":\"あ\"}";
    const byteLength = new TextEncoder().encode(body).byteLength;
    const tooSmall = await readJsonLimited(new Request("http://localhost", { method: "POST", body }), byteLength - 1);
    const exact = await readJsonLimited(new Request("http://localhost", { method: "POST", body }), byteLength);

    expect(tooSmall).toEqual({ ok: false, reason: "too-large" });
    expect(exact).toEqual({ ok: true, value: { text: "あ" } });
    expect(byteLength).toBeGreaterThan(body.length);
  });
});
