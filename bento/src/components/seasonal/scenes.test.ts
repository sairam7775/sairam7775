import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Scene } from "./scenes";
import { SCENE_THEMES, SEASONS, type Background } from "./season";

const draw = (season: Background) => renderToStaticMarkup(createElement(Scene, { season }));

describe("Scene", () => {
  it.each([...SCENE_THEMES])("draws the %s scene as hidden SVG layers", (theme) => {
    const html = draw(theme);
    const layers = html.match(/<svg/g) ?? [];
    expect(layers.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(layers.length);
    expect(html).toContain("season-far");
    expect(html).toContain("season-near");
    // No writing anywhere: no shop names, signs or lettering on lanterns.
    expect(html).not.toMatch(/<text|<tspan/);
    // Nothing filtered in the SVG itself; the only blur is the far layer's CSS.
    expect(html).not.toMatch(/filter=|<filter/);
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it("draws each scene differently from the summer fallback and from each other", () => {
    const all = [...SEASONS, ...SCENE_THEMES].map(draw);
    expect(new Set(all).size).toBe(all.length);
  });
});
