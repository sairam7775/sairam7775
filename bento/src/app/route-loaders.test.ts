import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A loading.tsx wraps everything below it in a Suspense boundary, so the
// first response carries the loader and the page is swapped in after it (by
// React's reveal script, which waits at least 300 ms after the loader paints).
// The home page draws its first screen without waiting on anything slow, so
// it must not sit behind one: no loading.tsx at the root. The app's other
// sections keep their loader, each in its own folder.
const at = (path: string) => existsSync(fileURLToPath(new URL(path, import.meta.url)));

describe("route loaders", () => {
  it("the home page has no loader in front of it", () => {
    expect(at("./loading.tsx")).toBe(false);
  });

  it.each([
    "./(auth)/loading.tsx",
    "./about/loading.tsx",
    "./admin/loading.tsx",
    "./auth/loading.tsx",
    "./cookies/loading.tsx",
    "./privacy/loading.tsx",
    "./settings/loading.tsx",
    "./shared/[token]/loading.tsx",
    "./terms/loading.tsx",
    "./trips/loading.tsx",
    "./trips/[id]/loading.tsx",
  ])("%s keeps its loader", (path) => {
    expect(at(path)).toBe(true);
  });
});
