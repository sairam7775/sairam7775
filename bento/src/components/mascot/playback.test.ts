import { describe, expect, it } from "vitest";
import { cheers, fileFor, segmentsOf, shouldAnimate } from "./playback";

describe("cheers", () => {
  it("cheers when a proposal goes from proposed to accepted", () => {
    expect(cheers("proposed", "accepted")).toBe(true);
  });

  it("doesn't cheer for a rejection, or for one already answered", () => {
    expect(cheers("proposed", "rejected")).toBe(false);
    expect(cheers("accepted", "accepted")).toBe(false);
    expect(cheers("rejected", "accepted")).toBe(false);
  });
});

describe("fileFor", () => {
  it("names the file of a figure that moves", () => {
    expect(fileFor("head-think")).toBe("/mascot/head-think.json");
  });

  it("gives a still-only figure no file, so nothing is fetched", () => {
    expect(fileFor("head-rest")).toBeNull();
  });
});

describe("shouldAnimate", () => {
  it("never animates for someone who asked for less motion", () => {
    expect(shouldAnimate({ reducedMotion: true, file: "/mascot/head-think.json" })).toBe(false);
  });

  it("never animates a figure with no file", () => {
    expect(shouldAnimate({ reducedMotion: false, file: null })).toBe(false);
  });

  it("animates otherwise", () => {
    expect(shouldAnimate({ reducedMotion: false, file: "/mascot/head-think.json" })).toBe(true);
  });
});

describe("segmentsOf", () => {
  it("reads the intro and the idle loop", () => {
    expect(segmentsOf([{ cm: "intro", tm: 0, dr: 72 }, { cm: "idle", tm: 72, dr: 120 }])).toEqual({ intro: [0, 72], idle: [72, 192] });
  });

  it("has no intro when it lasts no frames", () => {
    expect(segmentsOf([{ cm: "intro", tm: 0, dr: 0 }, { cm: "idle", tm: 0, dr: 144 }])).toEqual({ intro: null, idle: [0, 144] });
  });
});
