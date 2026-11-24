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
const APP = "https://bento.example/_next/static/chunks";

describe("an error on its way to PostHog", () => {
  it("loses a message that pretends to be stack frames (V8)", () => {
    const e = new Error("private trip\n    at Kyoto with Mum (/secret-booking.js:1:2)");
    // The leak as it was: the builder turns the message's second line into a frame.
    expect(JSON.stringify(builder.buildFromUnknown(e, { mechanism: { handled: true, type: "generic" } }))).toMatch(SECRET);
    expect(outgoing(e)).not.toMatch(SECRET);
  });

  it("keeps a frame's place in Bento's built code, without its function name", () => {
    const e = new Error("Kyoto with Mum");
    e.stack = [
      "Error: Kyoto with Mum",
      `    at Object.Kyoto (${APP}/app-1a2b.js?v=3:10:4)`,
      `    at ${APP}/main.js:1:1`,
    ].join("\n");
    const json = outgoing(e);
    expect(json).not.toMatch(SECRET);
    expect(json).toContain("chunks/app-1a2b.js");
    expect(json).toContain("chunks/main.js");
    expect(json).toContain(MESSAGE_REMOVED);
  });

  it("keeps a Firefox or Safari stack only when every line is a frame", () => {
    const clean = new Error("x");
    clean.stack = [`render@${APP}/app.js:10:4`, `@${APP}/main.js:1:1`, ""].join("\n");
    expect(outgoing(clean)).toContain("chunks/app.js");
    const mixed = new Error("x");
    mixed.stack = [`render@${APP}/app.js:10:4`, "Kyoto with Mum secret", `@${APP}/main.js:1:1`].join("\n");
    const json = outgoing(mixed);
    expect(json).not.toMatch(SECRET);
    expect(json).not.toContain("chunks/app.js");
  });

  // Codex's reproductions, 25 Nov 2026.
  it("keeps no frames when the message changed after the stack was made", () => {
    const e = new Error("private\n    at Kyoto (/secret.js:1:2)");
    void e.stack;
    e.message = "x";
    expect(outgoing(e)).not.toMatch(SECRET);
  });

  it("keeps no frames from a headerless stack whose lines are the message", () => {
    const e = new Error("private\nKyoto@https://bento.test/secret.js:1:2");
    e.stack = "Error: " + e.message;
    expect(outgoing(e)).not.toMatch(SECRET);
  });

  it("drops a real frame's function name, which code can set to anything", () => {
    const obj = {
      ["Kyoto"]() {
        return new Error("x");
      },
    };
    expect(outgoing(obj.Kyoto())).not.toMatch(SECRET);
  });

  it("keeps no file outside Bento's built code, not even a forged one under it", () => {
    const e = new Error("x");
    e.stack = ["Error: x", "    at f (https://bento.example/secret-Kyoto.js:1:1)", "    at g (/_next/static/Kyoto with Mum.js:1:1)"].join("\n");
    expect(outgoing(e)).not.toMatch(SECRET);
  });

  it("survives an error whose properties throw when read", () => {
    const e = new Error("x");
    Object.defineProperty(e, "stack", {
      get() {
        throw new Error("Kyoto");
      },
    });
    expect(() => safeError(e)).not.toThrow();
    expect(outgoing(e)).not.toMatch(SECRET);
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
