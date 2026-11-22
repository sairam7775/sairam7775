import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { invalidateGraphCache, loadGraph } from "../load";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

/** A client that answers like PostgREST: ordered, ranged, and never more
 *  than `cap` rows in one response, whatever range was asked for. */
function fakeDb(tables: Record<string, unknown[]>, opts: { cap?: number; fail?: { table: string; page: number } } = {}) {
  const cap = opts.cap ?? 1000;
  const pages: { table: string; from: number; to: number; order: string[]; count?: string }[] = [];
  const select = vi.fn();
  const from = vi.fn((table: string) => {
    const order: string[] = [];
    let count: string | undefined;
    const q = {
      select: (columns: string, o?: { count?: string }) => {
        select(columns);
        count = o?.count;
        return q;
      },
      order: (column: string) => {
        order.push(column);
        return q;
      },
      range: (a: number, b: number) => {
        const page = pages.filter((p) => p.table === table).length;
        pages.push({ table, from: a, to: b, order: [...order], count });
        if (opts.fail?.table === table && opts.fail.page === page) {
          return Promise.resolve({ data: null, error: new Error(`${table} page ${page} failed`), count: null });
        }
        const rows = tables[table] ?? [];
        return Promise.resolve({
          data: rows.slice(a, Math.min(b + 1, a + cap)),
          error: null,
          count: count === "exact" ? rows.length : null,
        });
      },
      // Awaited with no range, PostgREST still stops at its limit.
      then: (resolve: (r: unknown) => void) => {
        const rows = tables[table] ?? [];
        resolve({ data: rows.slice(0, cap), error: null, count: count === "exact" ? rows.length : null });
      },
    };
    return q;
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, select, pages };
}

const station = (id: string) => ({ id, name: id, name_ja: null, city_id: "test-city", coords: null, lines: [] });
const edge = (i: number, stationCount: number) => ({
  from_station: `s${i % stationCount}`,
  to_station: `s${(i + 1) % stationCount}`,
  line: `Line ${i}`,
  mode: "rail", operator: null, km: null, minutes: 2, fare_jpy: null, stops: 1, note: null,
});
const network = (stationCount: number, edgeCount: number) => ({
  stations: Array.from({ length: stationCount }, (_, i) => station(`s${i}`)),
  station_edges: Array.from({ length: edgeCount }, (_, i) => edge(i, stationCount)),
});
const edgeCount = (g: Awaited<ReturnType<typeof loadGraph>>) => [...g.out.values()].reduce((n, list) => n + list.length, 0);

describe("loadGraph", () => {
  afterEach(() => {
    invalidateGraphCache();
    vi.clearAllMocks();
  });

  function stationsReturn(coords: unknown) {
    return fakeDb({
      stations: [{ id: "kyoto", name: "Kyoto", name_ja: "京都", city_id: "kyoto-city", coords, lines: ["JR Kyoto Line"] }],
      station_edges: [],
    }).select;
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

  // The committed seed has 1,008 edges; PostgREST answers at most 1,000
  // rows per request by default and says nothing about the rest.
  it("reads every edge past the server's 1,000-row limit", async () => {
    const { pages } = fakeDb(network(40, 1008));

    const graph = await loadGraph();

    expect(edgeCount(graph)).toBe(1008);
    expect(pages.filter((p) => p.table === "station_edges").length).toBe(2);
  });

  it("reads every station past the limit too", async () => {
    fakeDb(network(1001, 0));

    expect((await loadGraph()).stations.size).toBe(1001);
  });

  it("asks for a stable order so pages neither skip nor repeat rows", async () => {
    const { pages } = fakeDb(network(3, 3));

    await loadGraph();

    expect(pages.find((p) => p.table === "stations")?.order).toEqual(["id"]);
    expect(pages.find((p) => p.table === "station_edges")?.order).toEqual(["from_station", "to_station", "line"]);
  });

  it("stops on an exact multiple of the page size", async () => {
    const { pages } = fakeDb(network(40, 2000));

    expect(edgeCount(await loadGraph())).toBe(2000);
    expect(pages.filter((p) => p.table === "station_edges").length).toBeLessThanOrEqual(3);
  });

  it("still reads everything when the server's limit is lower than a page", async () => {
    fakeDb(network(40, 1008), { cap: 300 });

    expect(edgeCount(await loadGraph())).toBe(1008);
  });

  it("fails the load when a later page fails, and caches nothing", async () => {
    const db = fakeDb(network(40, 1008), { fail: { table: "station_edges", page: 1 } });

    await expect(loadGraph()).rejects.toThrow("station_edges page 1 failed");

    // Nothing partial was kept: the next call reads the database again.
    db.from.mockClear();
    fakeDb(network(40, 1008));
    expect(edgeCount(await loadGraph())).toBe(1008);
  });

  it("serves the cached graph without reading again", async () => {
    const { from } = fakeDb(network(3, 3));

    await loadGraph();
    const calls = from.mock.calls.length;
    await loadGraph();

    expect(from.mock.calls.length).toBe(calls);
  });

  // The trip page works out its travel days and its moves at once; with no
  // graph cached yet, both used to read the whole network.
  it("shares one read between loads that start before it finishes", async () => {
    const { from } = fakeDb(network(3, 3));

    const [a, b] = await Promise.all([loadGraph(), loadGraph()]);

    expect(a).toBe(b);
    expect(from.mock.calls.map(([t]) => t).sort()).toEqual(["station_edges", "stations"]);
  });

  it("keeps a read started before the cache was cleared out of the cache", async () => {
    const old = fakeDb(network(3, 3));
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.mocked(createClient).mockImplementationOnce(async () => { await gate; return { from: old.from } as never; });
    const before = loadGraph();
    invalidateGraphCache();
    fakeDb(network(5, 5));
    const after = loadGraph();

    expect((await after).stations.size).toBe(5);
    release();
    expect((await before).stations.size).toBe(3);
    // The newer read's graph stays cached; the older one didn't overwrite it.
    expect((await loadGraph()).stations.size).toBe(5);
  });

  it("doesn't let an older read's end drop a newer read under way", async () => {
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    const oldGate = new Promise<void>((r) => { releaseOld = r; });
    const newGate = new Promise<void>((r) => { releaseNew = r; });
    const { from } = fakeDb(network(3, 3));
    vi.mocked(createClient)
      .mockImplementationOnce(async () => { await oldGate; return { from } as never; })
      .mockImplementationOnce(async () => { await newGate; return { from } as never; });
    const first = loadGraph();
    invalidateGraphCache();
    const second = loadGraph();
    releaseOld();
    await first;
    // Still under way: a third load joins the second read.
    const third = loadGraph();
    releaseNew();
    expect(await third).toBe(await second);
    expect(vi.mocked(createClient)).toHaveBeenCalledTimes(2);
  });

  it("lets a load after a shared failure read again", async () => {
    fakeDb(network(40, 1008), { fail: { table: "station_edges", page: 1 } });
    const both = await Promise.allSettled([loadGraph(), loadGraph()]);
    expect(both.map((r) => r.status)).toEqual(["rejected", "rejected"]);

    fakeDb(network(40, 1008));
    expect(edgeCount(await loadGraph())).toBe(1008);
  });
});
