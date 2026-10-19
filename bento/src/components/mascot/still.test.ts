import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MascotStill } from "./still";

const draw = (figure: Parameters<typeof MascotStill>[0]["figure"], size: number) =>
  renderToStaticMarkup(createElement(MascotStill, { figure, size }));

describe("MascotStill", () => {
  it("draws the thinking head at the asked size", () => {
    const html = draw("head-think", 40);
    expect(html).toContain('viewBox="-6 -10 76 80"');
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("marks each colour with its role and the light colour", () => {
    const html = draw("head-rest", 24);
    expect(html).toContain('class="bm-f-rim"');
    expect(html).toContain('class="bm-s-sheen"');
    expect(html).toContain('fill="#FF7757"');
  });

  it("sizes the full figure by its height", () => {
    const html = draw("full-hello", 132);
    expect(html).toContain('viewBox="0 -10 96 132"');
    expect(html).toContain('height="132"');
    expect(html).toContain('width="96"');
  });

  it("hides a part that rests invisible", () => {
    // head-hello's open right eye waits, hidden, for the wink to end.
    expect(draw("head-hello", 40)).toContain('opacity="0"');
  });

  it("follows the theme even outside the figure wrapper", () => {
    expect(draw("head-rest", 24)).toMatch(/^<svg[^>]* class="mascot"/);
  });

  it("places a part where its figure puts it", () => {
    expect(draw("head-think", 40)).toContain('transform="translate(1.6 -1.8)"');
  });
});
