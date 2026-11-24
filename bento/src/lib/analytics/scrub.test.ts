import { describe, expect, it } from "vitest";
import { MESSAGE_REMOVED, scrubEvent } from "./scrub";

// The shape posthog-js 1.435 builds for an error ($exception), whether
// captured by Bento (`trackError`) or on its own (`capture_exceptions`).
const exception = () => ({
  event: "$exception",
  properties: {
    $exception_list: [
      {
        type: "TypeError",
        value: "Cannot read 'Kyoto with Mum, booking ABC123' of undefined",
        mechanism: { handled: false, type: "onerror" },
        stacktrace: {
          type: "raw",
          frames: [
            { filename: "https://bento.example/_next/static/chunks/app.js?v=1", function: "render", lineno: 10, colno: 4, in_app: true },
          ],
        },
      },
      { type: "Error", value: "caused by: me@example.com typed this" },
    ],
    $exception_message: "Cannot read 'Kyoto with Mum, booking ABC123' of undefined",
    $exception_type: "TypeError",
    $exception_level: "error",
    $exception_values: ["Cannot read 'Kyoto with Mum, booking ABC123' of undefined"],
    $exception_steps: [{ $message: "clicked 'Kyoto with Mum'" }],
    $current_url: "https://bento.example/trips/1?error=Kyoto+with+Mum",
    digest: "123456",
    boundary: "page",
  },
});

describe("scrubEvent", () => {
  it("removes every error message and the steps before it, keeping type, stack and digest", () => {
    const e = scrubEvent(exception());
    const p = e.properties as Record<string, unknown>;
    const json = JSON.stringify(e);
    expect(json).not.toMatch(/Kyoto|ABC123|example\.com|typed this/);
    expect(p.$exception_message).toBe(MESSAGE_REMOVED);
    expect(p.$exception_values).toBeUndefined();
    expect(p.$exception_steps).toBeUndefined();
    const list = p.$exception_list as { type: string; value: string; stacktrace?: { frames: { filename: string; function: string; lineno: number }[] } }[];
    expect(list.map((x) => x.type)).toEqual(["TypeError", "Error"]);
    expect(list.every((x) => x.value === MESSAGE_REMOVED)).toBe(true);
    expect(list[0].stacktrace!.frames[0]).toMatchObject({ filename: "https://bento.example/_next/static/chunks/app.js", function: "render", lineno: 10 });
    expect(p.$exception_type).toBe("TypeError");
    expect(p.digest).toBe("123456");
    expect(p.$current_url).toBe("https://bento.example/trips/1");
  });

  it("strips addresses in nested properties too, not only top-level ones", () => {
    const e = scrubEvent({ event: "x", properties: { a: { b: ["https://bento.example/p?q=secret#h"] } } });
    expect(JSON.stringify(e)).not.toMatch(/secret/);
  });

  it("leaves an ordinary event's values alone apart from addresses", () => {
    const e = scrubEvent({ event: "proposal_answered", properties: { kind: "route", accepted: true, n: 3 } });
    expect(e.properties).toEqual({ kind: "route", accepted: true, n: 3 });
  });

  it("leaves a recording's nested data as the recorder masked it, cutting only its top-level addresses", () => {
    const data = [{ type: 2, data: { node: { attributes: { src: "https://cdn.example/img.png?w=200" } } } }];
    const e = scrubEvent({ event: "$snapshot", properties: { $snapshot_data: data, $current_url: "https://b.example/t?x=1" } });
    expect((e.properties as Record<string, unknown>).$snapshot_data).toBe(data);
    expect((e.properties as Record<string, unknown>).$current_url).toBe("https://b.example/t");
  });

  it("also scrubs $set and $set_once", () => {
    const e = scrubEvent({ event: "$pageview", properties: {}, $set: { $current_url: "https://b.example/x?y=1" }, $set_once: { $initial_current_url: "https://b.example/z#k" } });
    expect(e.$set).toEqual({ $current_url: "https://b.example/x" });
    expect(e.$set_once).toEqual({ $initial_current_url: "https://b.example/z" });
  });
});
