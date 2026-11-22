import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The largest text on the first screen is what the browser times as the
// page's Largest Contentful Paint. An element that starts at opacity 0 isn't
// painted until it fades in, so the first screen's text settles by movement
// only (`.settle`); `.up` (fade and rise) is for what comes after it.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const css = read("./globals.css");

const block = (selector: RegExp) => css.match(selector)?.[0] ?? "";

describe("first-screen text paints at once", () => {
  it("settle moves without fading", () => {
    const keyframes = block(/@keyframes settle\s*\{[^}]*\}[^}]*\}/);
    expect(keyframes).toContain("transform");
    expect(keyframes).not.toMatch(/opacity/);
    expect(css).toMatch(/\.settle\s*\{\s*animation:\s*settle\b/);
  });

  it("settle is off under reduced motion, like up", () => {
    const reduced = block(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/);
    expect(reduced).toMatch(/\.up,[^{]*\.settle[^{]*\{\s*animation: none/);
  });

  // The first text each page shows: it must not start invisible.
  const firsts: [string, RegExp][] = [
    ["./page.tsx", /<header className="settle /],
    ["./page.tsx", /\{\/\* Hero \*\/\}[\s\S]*?<div className="settle"/],
    ["../components/app-header.tsx", /<header className="settle /],
    ["./trips/page.tsx", /<div className="settle mt-8 /],
    ["./trips/plan/page.tsx", /<section className="tile settle mt-8 /],
    ["./trips/[id]/page.tsx", /<header className="settle" /],
    ["./trips/[id]/vault/page.tsx", /<header className="settle mt-7" /],
    ["./(auth)/ui.tsx", /<header className="settle /],
    ["./(auth)/ui.tsx", /<section className="tile settle p-6 /],
    ["./settings/ui.tsx", /<h1 className="settle mt-8 /],
    ["../components/legal/legal-page.tsx", /<article className="tile settle /],
    ["../components/status-page.tsx", /<section className="tile settle /],
  ];
  it.each(firsts)("%s starts visible", (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });

  it("the home hero no longer fades in", () => {
    const hero = read("./page.tsx").split("{/* Hero */}")[1].split("<DayPreview")[0];
    expect(hero).not.toMatch(/className="up\b/);
  });
});
