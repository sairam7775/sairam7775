import { describe, expect, it } from "vitest";
import { MESSAGE_REMOVED, VALUE_OMITTED, scrubEvent } from "./scrub";

// A superset of what posthog-js 1.435 may send for an error ($exception):
// its builder, its suppression copies and its Sentry integration together.
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

  it("sends an exception's type only from the known list", () => {
    const e = scrubEvent({ event: "$exception", properties: { $exception_type: "Kyoto with Mum", $exception_list: [{ type: "Kyoto with Mum", value: "x" }, { type: "RangeError", value: "y" }] } });
    const p = e.properties as Record<string, unknown>;
    expect(p.$exception_type).toBe("Error");
    expect((p.$exception_list as { type: string }[]).map((x) => x.type)).toEqual(["Error", "RangeError"]);
  });

  it("drops the Sentry copies of the message", () => {
    const e = scrubEvent({ event: "$exception", properties: { $sentry_exception: { values: ["Kyoto"] }, $sentry_exception_message: "Kyoto" } });
    expect(JSON.stringify(e)).not.toMatch(/Kyoto/);
  });

  it("cuts a loop or a value too deep instead of failing (which would drop the event), keeps shared values and dates", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    const shared = { k: "v" };
    let nested: Record<string, unknown> = { end: true };
    for (let i = 0; i < 20; i++) nested = { n: nested };
    const p = scrubEvent({ event: "x", properties: { loop, one: shared, two: shared, when: new Date("2026-11-25T00:00:00Z"), nested } }).properties as Record<string, unknown>;
    expect((p.loop as Record<string, unknown>).self).toBe(VALUE_OMITTED);
    expect(p.one).toEqual({ k: "v" });
    expect(p.two).toEqual({ k: "v" });
    expect(p.when).toBe("2026-11-25T00:00:00.000Z");
    expect(JSON.stringify(p.nested)).toContain(VALUE_OMITTED);
  });

  it("leaves its input untouched", () => {
    const input = exception();
    const before = JSON.stringify(input);
    scrubEvent(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("cuts heatmap address keys to their path, merging points on the same page", () => {
    const e = scrubEvent({
      event: "$$heatmap",
      properties: {
        $heatmap_data: {
          "https://bento.test/trips?error=Kyoto#ABC123": [{ x: 1, y: 2 }],
          "https://bento.test/trips": [{ x: 3, y: 4 }],
        },
      },
    });
    expect(JSON.stringify(e)).not.toMatch(/Kyoto|ABC123/);
    expect((e.properties as Record<string, unknown>).$heatmap_data).toEqual({ "https://bento.test/trips": [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
  });

  it("drops the page title and values lifted out of an address, first-seen copies too", () => {
    const e = scrubEvent({
      event: "$pageview",
      properties: { title: "Kyoto with Mum", utm_content: "Kyoto", gclid: "x", $search_engine: "google", ph_keyword: "Kyoto", $pathname: "/trips" },
      $set: { $initial_utm_source: "Kyoto" },
      $set_once: { $session_entry_utm_term: "Kyoto", $initial_title: "Kyoto" },
    });
    expect(JSON.stringify(e)).not.toMatch(/Kyoto|google/);
    expect((e.properties as Record<string, unknown>).$pathname).toBe("/trips");
  });

  it("drops lifted values under PostHog's own field names, inside properties.$set too", () => {
    const e = scrubEvent({
      event: "$identify",
      properties: {
        msclkid: "Kyoto",
        rdt_cid: "Kyoto",
        sccid: "Kyoto",
        $initial_search_engine: "Kyoto",
        $set: { $initial_utm_campaign: "Kyoto", $initial_msclkid: "Kyoto", plan: "free" },
        $set_once: { $initial_title: "Kyoto", $session_entry_ph_keyword: "Kyoto" },
      },
    });
    expect(JSON.stringify(e)).not.toMatch(/Kyoto/);
    expect(((e.properties as Record<string, unknown>).$set as Record<string, unknown>).plan).toBe("free");
  });

  it("also scrubs $set and $set_once", () => {
    const e = scrubEvent({ event: "$pageview", properties: {}, $set: { $current_url: "https://b.example/x?y=1" }, $set_once: { $initial_current_url: "https://b.example/z#k" } });
    expect(e.$set).toEqual({ $current_url: "https://b.example/x" });
    expect(e.$set_once).toEqual({ $initial_current_url: "https://b.example/z" });
  });
});
