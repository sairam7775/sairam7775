import { describe, expect, it } from "vitest";
import { drawOrder, FIGURES, valueAt } from "./moods";
import type { Figure } from "./types";

const figures: Figure[] = Object.values(FIGURES);

describe("Bento Man's figures", () => {
  it("starts every track on the still pose", () => {
    for (const f of figures)
      for (const t of f.tracks) {
        const part = f.parts.find((p) => p.id === t.part)!;
        const s = part.restScale ?? 100;
        const rest = { position: [0, 0], rotation: 0, scale: [s, s], opacity: part.opacity ?? 100 }[t.prop];
        expect(t.keys[0], `${f.key} ${t.part}.${t.prop}`).toEqual([0, rest]);
      }
  });

  it("loops without a seam", () => {
    for (const f of figures)
      for (const t of f.tracks)
        expect(valueAt(t, f.intro), `${f.key} ${t.part}.${t.prop}`).toEqual(valueAt(t, f.intro + f.idle));
  });

  it("names only parts that exist, once each", () => {
    for (const f of figures) {
      const ids = f.parts.map((p) => p.id);
      expect(new Set(ids).size, `${f.key} has a repeated id`).toBe(ids.length);
      for (const p of f.parts) if (p.parent) expect(ids, `${f.key} ${p.id}'s parent`).toContain(p.parent);
      for (const t of f.tracks) expect(ids, `${f.key} track`).toContain(t.part);
    }
  });

  it("keeps keyframes in order and inside the timeline", () => {
    for (const f of figures)
      for (const t of f.tracks) {
        const frames = t.keys.map(([frame]) => frame);
        for (let i = 1; i < frames.length; i++) expect(frames[i], `${f.key} ${t.part}.${t.prop}`).toBeGreaterThan(frames[i - 1]);
        expect(frames.at(-1)!, `${f.key} ${t.part}.${t.prop}`).toBeLessThanOrEqual(f.intro + f.idle);
      }
  });

  it("gives every part that turns or scales a pivot", () => {
    for (const f of figures)
      for (const t of f.tracks)
        if (t.prop === "rotation" || t.prop === "scale")
          expect(f.parts.find((p) => p.id === t.part)!.pivot, `${f.key} ${t.part}`).toBeDefined();
  });

  it("draws every part once, parents before their children", () => {
    for (const f of figures) {
      const order = drawOrder(f).map((p) => p.id);
      expect([...order].sort()).toEqual(f.parts.map((p) => p.id).sort());
      for (const p of f.parts) if (p.parent) expect(order.indexOf(p.parent)).toBeLessThan(order.indexOf(p.id));
    }
  });
});

describe("valueAt", () => {
  const track = { part: "x", prop: "rotation" as const, keys: [[0, 0], [10, 20], [20, 0]] as [number, number][] };

  it("eases between keys and holds after the last", () => {
    expect(valueAt(track, 5)).toBeCloseTo(10, 5);
    expect(valueAt(track, 25)).toBe(0);
  });

  it("steps when the track holds", () => {
    expect(valueAt({ ...track, hold: true }, 9)).toBe(0);
    expect(valueAt({ ...track, hold: true }, 10)).toBe(20);
  });
});
