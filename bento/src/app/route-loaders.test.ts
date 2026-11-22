import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A loading.tsx wraps everything below it in a Suspense boundary, so the
// first response carries the loader and the page is swapped in after it (by
// React's reveal script, which waits at least 300 ms after the loader paints).
// The home page draws its first screen without waiting on anything slow, so
// it must not sit behind one: no loading.tsx at the root. Every other page
// keeps a loader, from its own folder or one above it below the root.
const app = dirname(fileURLToPath(import.meta.url));

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function hasLoaderAbove(page: string): boolean {
  for (let dir = dirname(page); dir !== app; dir = dirname(dir)) {
    if (existsSync(join(dir, "loading.tsx"))) return true;
  }
  return false;
}

const others = pages(app).filter((page) => dirname(page) !== app);

describe("route loaders", () => {
  it("the home page has no loader in front of it", () => {
    expect(existsSync(join(app, "page.tsx"))).toBe(true);
    expect(existsSync(join(app, "loading.tsx"))).toBe(false);
  });

  it("finds the other pages", () => {
    expect(others.length).toBeGreaterThan(20);
  });

  it.each(others.map((page) => relative(app, page)))("%s keeps a loader", (page) => {
    expect(hasLoaderAbove(join(app, page))).toBe(true);
  });
});
