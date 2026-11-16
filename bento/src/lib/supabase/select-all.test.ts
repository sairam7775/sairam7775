import { describe, expect, it } from "vitest";
import { selectAll } from "./select-all";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("selectAll", () => {
  it("stops on a short page when the query has no count", async () => {
    const all = rows(25);
    const asked: number[] = [];
    const got = await selectAll((from, to) => {
      asked.push(from);
      return Promise.resolve({ data: all.slice(from, to + 1), error: null });
    }, 10);
    expect(got).toEqual(all);
    expect(asked).toEqual([0, 10, 20]);
  });

  it("refuses a table that ran out before its count", async () => {
    await expect(
      selectAll((from, to) => Promise.resolve({ data: rows(15).slice(from, to + 1), error: null, count: 20 }), 10),
    ).rejects.toThrow("read 15 of 20 rows");
  });

  it("refuses a page bigger than it asked for", async () => {
    await expect(selectAll(() => Promise.resolve({ data: rows(11), error: null }), 10)).rejects.toThrow("more than the 10");
  });

  it("starts again when the count changes between pages, so no row is missed", async () => {
    // Five rows; row 1 is deleted after the first page is read. Without a
    // restart the second page starts at offset 3 and skips row 3.
    let table = rows(5);
    let reads = 0;
    const got = await selectAll((from, to) => {
      if (reads++ === 1) table = table.filter((r) => r !== 1);
      return Promise.resolve({ data: table.slice(from, to + 1), error: null, count: table.length });
    }, 3);
    expect(got).toEqual([0, 2, 3, 4]);
  });

  it("gives up after three tries when the count keeps changing", async () => {
    let n = 10;
    let calls = 0;
    await expect(
      selectAll((from, to) => (calls++, Promise.resolve({ data: rows(n).slice(from, to + 1), error: null, count: n++ })), 3),
    ).rejects.toThrow("row count changed");
    expect(calls).toBe(6);
  });

  it("returns an empty table in one request", async () => {
    let calls = 0;
    expect(await selectAll(() => (calls++, Promise.resolve({ data: [], error: null, count: 0 })), 10)).toEqual([]);
    expect(calls).toBe(1);
  });
});
