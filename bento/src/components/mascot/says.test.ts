import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BentoManSays } from "./says";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("BentoManSays", () => {
  it("puts his words in a bubble beside him, and keeps him decoration", () => {
    const html = renderToStaticMarkup(createElement(BentoManSays, { figure: "head-rest", size: 24 }, "Fifty minutes each way."));
    const [figure, bubble] = html.split('class="says');
    expect(figure).toContain('aria-hidden="true"');
    expect(bubble).toContain("Fifty minutes each way.");
    expect(bubble).not.toContain("aria-hidden");
  });

  it("is a tile on the page and sunk inside a panel", () => {
    const on = (tone?: "page" | "panel") =>
      renderToStaticMarkup(createElement(BentoManSays, { figure: "head-rest", size: 24, tone }, "x")).match(/class="says ([^"]*)"/)?.[1] ?? "";
    expect(on()).toMatch(/\btile\b/);
    expect(on("panel")).toMatch(/\bbg-sunk\b/);
    expect(on("panel")).not.toMatch(/\btile\b/);
  });

  it("has a tail pointing at him and a tight corner on his side", () => {
    const css = read("../../app/globals.css");
    expect(css).toMatch(/\.says::before\s*\{[^}]*clip-path/);
    expect(css).toMatch(/\.says\s*\{[^}]*border-top-left-radius/);
    // After .tile, so its corner wins over the tile's.
    expect(css.indexOf(".says {")).toBeGreaterThan(css.indexOf(".tile {"));
  });

  // Everywhere he speaks to the traveller, the words sit in the same bubble.
  const speaks: [string, string][] = [
    ["home page sample note", "../../app/page.tsx"],
    ["Bookings tip", "../../app/trips/[id]/vault/bento-man-card.tsx"],
    ["chat replies and first hello", "../../app/trips/[id]/chat.tsx"],
    ["trips greeting", "../../app/trips/page.tsx"],
  ];
  it.each(speaks)("the %s uses it", (_, file) => {
    expect(read(file)).toMatch(/<BentoManSays\b/);
  });

  it("carries both the chat's first hello and every reply", () => {
    const chat = read("../../app/trips/[id]/chat.tsx");
    expect(chat).toMatch(/<BentoManSays figure="full-hello"[^>]*tone="panel"/);
    expect(chat).toMatch(/<BentoManSays figure=\{[^}]*"head-rest"[^}]*\}[^>]*tone="panel"/);
  });

  it("shows one head while he works: the bubble's own, thinking", () => {
    const chat = read("../../app/trips/[id]/chat.tsx");
    const reply = chat.match(/<BentoManSays figure=\{[^}]*\}[\s\S]*?<\/BentoManSays>/)?.[0] ?? "";
    expect(reply).toMatch(/figure=\{[^}]*"head-think"[^}]*"head-rest"/);
    const workings = reply.match(/<Working\b[^>]*>/g) ?? [];
    expect(workings.length).toBeGreaterThan(0);
    for (const w of workings) expect(w).toMatch(/\bbare\b/);
  });

  it("wraps a long name in the trips greeting inside the bubble", () => {
    expect(read("../../app/trips/page.tsx")).toMatch(/<span className="[^"]*\bmin-w-0\b[^"]*\bbreak-words\b[^"]*">\{name \?/);
  });

  it("no longer sets the home note or the Bookings tip beside a bare figure", () => {
    expect(read("../../app/page.tsx")).not.toMatch(/<BentoManFigure\b/);
    expect(read("../../app/trips/[id]/vault/bento-man-card.tsx")).not.toMatch(/<BentoManFigure\b/);
  });
});
