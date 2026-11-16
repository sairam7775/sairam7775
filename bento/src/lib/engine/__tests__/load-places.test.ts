import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { loadPlacesForCity } from "../load";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

/** Answers like PostgREST: at most `cap` rows a response, and a count only
 *  when the query asks for `{ count: "exact" }`. */
function fakeDb(places: Record<string, unknown>[], cap: number) {
  const ranges: number[] = [];
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    let count: string | undefined;
    const q = {
      select: (_columns?: string, o?: { count?: string }) => ((count = o?.count), q),
      eq: (column: string, value: unknown) => (filters.push([column, value]), q),
      order: () => q,
      maybeSingle: async () => ({ data: table === "cities" ? { coverage_tier: "deep" } : null, error: null }),
      range: async (a: number, b: number) => {
        ranges.push(a);
        const rows = places.filter((r) => filters.every(([c, v]) => r[c] === v));
        return { data: rows.slice(a, Math.min(b + 1, a + cap)), error: null, count: count === "exact" ? rows.length : null };
      },
    };
    return q;
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { ranges };
}

const place = (i: number, city = "kyoto-city") => ({ id: `p-${String(i).padStart(4, "0")}`, city_id: city, name: `Place ${i}` });

describe("loadPlacesForCity", () => {
  afterEach(() => vi.clearAllMocks());

  it("reads every place in the city past the server's row limit", async () => {
    const { ranges } = fakeDb([...Array.from({ length: 1005 }, (_, i) => place(i)), place(9999, "nara")], 1000);

    const got = await loadPlacesForCity("kyoto-city");

    expect(got).toHaveLength(1005);
    expect(new Set(got.map((p) => p.id)).size).toBe(1005);
    expect(ranges).toEqual([0, 1000]);
  });

  it("reads everything when the server's limit is lower than a page", async () => {
    fakeDb(Array.from({ length: 650 }, (_, i) => place(i)), 300);

    expect(await loadPlacesForCity("kyoto-city")).toHaveLength(650);
  });
});
