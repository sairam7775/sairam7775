import { describe, expect, it } from "vitest";
import {
  DOMExceptionCoercer,
  ErrorCoercer,
  ErrorEventCoercer,
  ErrorPropertiesBuilder,
  EventCoercer,
  ObjectCoercer,
  PrimitiveCoercer,
  PromiseRejectionEventCoercer,
  StringCoercer,
  chromeStackLineParser,
  createStackParser,
  geckoStackLineParser,
} from "@posthog/core/error-tracking";
import { safeError } from "./safe-error";
import { MESSAGE_REMOVED, scrubEvent } from "./scrub";

// The builder posthog-js (1.435) runs on what captureException is given, so
// these check the payload PostHog would really build, not a hand-made one.
const builder = new ErrorPropertiesBuilder(
  [
    new DOMExceptionCoercer(),
    new PromiseRejectionEventCoercer(),
    new ErrorEventCoercer(),
    new ErrorCoercer(),
    new EventCoercer(),
    new ObjectCoercer(),
    new StringCoercer(),
    new PrimitiveCoercer(),
  ],
  createStackParser("web:javascript", chromeStackLineParser, geckoStackLineParser),
);
const outgoing = (thrown: unknown) =>
  JSON.stringify(
    scrubEvent({ event: "$exception", properties: { ...builder.buildFromUnknown(safeError(thrown), { mechanism: { handled: true, type: "generic" } }) } }),
  );
const SECRET = /Kyoto|Mum|secret|ABC123|example\.com/;

describe("an error on its way to PostHog", () => {
  it("loses a message that pretends to be stack frames (V8)", () => {
    const e = new Error("private trip\n    at Kyoto with Mum (/secret-booking.js:1:2)");
    // The leak as it was: the builder turns the message's second line into a frame.
    expect(JSON.stringify(builder.buildFromUnknown(e, { mechanism: { handled: true, type: "generic" } }))).toMatch(SECRET);
    expect(outgoing(e)).not.toMatch(SECRET);
  });

  it("keeps the real frames, so the error can still be found in the code", () => {
    const json = outgoing(new Error("Kyoto with Mum"));
    expect(json).toMatch(/safe-error\.test\.ts/);
    expect(json).toContain(MESSAGE_REMOVED);
  });

  it("loses a Firefox or Safari stack's lines that aren't frames", () => {
    const e = new Error("x");
    e.stack = "render@https://bento.example/_next/static/chunks/app.js:10:4\nKyoto with Mum secret\n@https://bento.example/_next/static/chunks/main.js:1:1";
    const json = outgoing(e);
    expect(json).not.toMatch(SECRET);
    expect(json).toMatch(/chunks\/app\.js/);
  });

  it("names the type only from a known list, never from the error or object itself", () => {
    const named = new Error("x");
    named.name = "Kyoto with Mum";
    for (const thrown of [named, { name: "Kyoto with Mum", message: "ABC123" }]) {
      const json = outgoing(thrown);
      expect(json).not.toMatch(SECRET);
      expect(json).toMatch(/"type":"Error"/);
    }
    expect(outgoing(new TypeError("Kyoto"))).toMatch(/"type":"TypeError"/);
  });

  it("loses thrown strings, objects, causes and aggregated errors", () => {
    for (const thrown of [
      "Kyoto with Mum",
      { message: "booking ABC123", stack: "    at Kyoto (/secret.js:1:1)" },
      new Error("outer", { cause: new Error("Kyoto with Mum") }),
      new AggregateError([new Error("Kyoto"), "me@example.com"], "secret"),
      null,
      42,
    ])
      expect(outgoing(thrown)).not.toMatch(SECRET);
  });

  it("is never the object it was given", () => {
    const e = new Error("Kyoto");
    expect(safeError(e)).not.toBe(e);
    expect(e.message).toBe("Kyoto");
  });
});
