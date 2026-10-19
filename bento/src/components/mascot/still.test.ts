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

  it("places a part where its figure puts it", () => {
    expect(draw("head-think", 40)).toContain('transform="translate(1.6 -1.8)"');
  });
});
