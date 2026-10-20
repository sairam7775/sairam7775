import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { invalidateGraphCache, loadGraph } from "../load";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("loadGraph", () => {
  afterEach(() => {
    invalidateGraphCache();
    vi.clearAllMocks();
  });

  function stationsReturn(coords: unknown) {
    const select = vi.fn((columns: string) => Promise.resolve({
      data: columns.startsWith("id, name")
        ? [{ id: "kyoto", name: "Kyoto", name_ja: "京都", city_id: "kyoto-city", coords, lines: ["JR Kyoto Line"] }]
        : [],
      error: null,
    }));
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select })) } as never);
    return select;
  }

  // What the database really returns for Kyoto's point: hex EWKB
  // (little-endian, a point with SRID 4326, then longitude and latitude).
  it("reads a station's location from the hex the database returns", async () => {
    const select = stationsReturn("0101000020E61000008E06F01648F86040CA32C4B12E7E4140");

    const graph = await loadGraph();

    expect(select).toHaveBeenCalledWith("id, name, name_ja, city_id, coords, lines");
    expect(graph.stations.get("kyoto")).toMatchObject({ lat: 34.9858, lon: 135.7588 });
  });

  it("leaves the location out when it can't be read", async () => {
    stationsReturn("not a point");

    const station = (await loadGraph()).stations.get("kyoto");

    expect(station?.lat).toBeUndefined();
    expect(station?.lon).toBeUndefined();
  });
});
