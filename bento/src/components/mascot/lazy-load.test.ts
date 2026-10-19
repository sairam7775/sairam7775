import { describe, expect, it } from "vitest";
import { withFallback } from "./lazy-load";

const Real = () => null;
const Fallback = () => null;

describe("withFallback", () => {
  it("gives the component when its code loads", async () => {
    expect((await withFallback(async () => Real, Fallback)()).default).toBe(Real);
  });

  it("gives the fallback, not an error, when its code can't load", async () => {
    // React.lazy rethrows a rejected load on every render, which would take the
    // error and 404 pages down with it.
    const load = withFallback(() => Promise.reject(new Error("ChunkLoadError")), Fallback);
    await expect(load()).resolves.toEqual({ default: Fallback });
  });
});
