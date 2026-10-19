import { createElement as h, type ReactElement, type ReactNode } from "react";
import { CANVAS, figureOf } from "./moods";
import { ROLE_COLOR, type FigureKey, type Part, type Shape } from "./types";

/** A figure's still pose as inline SVG: what the server sends, and all that
 *  shows when motion is off or the player can't load. Written without JSX
 *  so the tests can render it. Each colour carries its role as a class
 *  (`bm-f-coat`, `bm-s-line`), which globals.css maps to the theme. */
export function MascotStill({ figure, size }: { figure: FigureKey; size: number }): ReactElement {
  const f = figureOf(figure);
  const c = CANVAS[f.form];
  const width = f.form === "head" ? size : Math.round((size * c.w) / c.h);
  const childrenOf = (id: string | undefined) => f.parts.filter((p) => p.parent === id);

  const part = (p: Part): ReactNode =>
    h(
      "g",
      { key: p.id, transform: placement(p), opacity: p.opacity === undefined || p.opacity === 100 ? undefined : p.opacity / 100 },
      ...p.shapes.map((s, i) => shape(s, `${p.id}-${i}`)),
      ...childrenOf(p.id).map(part),
    );

  return h(
    "svg",
    { viewBox: `${-c.offset[0]} ${-c.offset[1]} ${c.w} ${c.h}`, width, height: size, "aria-hidden": "true", focusable: "false" },
    ...childrenOf(undefined).map(part),
  );
}

/** `at`, `scale` and a rest scale about the pivot, as an SVG transform. */
function placement(p: Part): string | undefined {
  const t: string[] = [];
  if (p.at) t.push(`translate(${p.at[0]} ${p.at[1]})`);
  if (p.scale !== undefined && p.scale !== 1) t.push(`scale(${p.scale})`);
  if (p.restScale !== undefined && p.restScale !== 100) {
    const [x, y] = p.pivot ?? [0, 0];
    t.push(`translate(${x} ${y}) scale(${p.restScale / 100}) translate(${-x} ${-y})`);
  }
  return t.length ? t.join(" ") : undefined;
}

function shape(s: Shape, key: string): ReactNode {
  const cls = [s.fill && `bm-f-${s.fill}`, s.stroke && `bm-s-${s.stroke}`].filter(Boolean).join(" ");
  const paint = {
    key,
    className: cls || undefined,
    fill: s.fill ? ROLE_COLOR[s.fill] : "none",
    fillOpacity: s.fill && s.opacity !== undefined ? s.opacity / 100 : undefined,
    stroke: s.stroke ? ROLE_COLOR[s.stroke] : undefined,
    strokeOpacity: s.stroke && s.opacity !== undefined ? s.opacity / 100 : undefined,
    strokeWidth: s.stroke ? s.width : undefined,
    strokeLinecap: s.stroke ? s.cap : undefined,
    strokeLinejoin: s.stroke ? s.join : undefined,
    strokeDasharray: s.dash ? s.dash.join(" ") : undefined,
  };
  if (s.kind === "rect") return h("rect", { ...paint, x: s.x, y: s.y, width: s.w, height: s.h, rx: s.r });
  if (s.kind === "ellipse") return h("ellipse", { ...paint, cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry });
  return h("path", { ...paint, d: s.d });
}
