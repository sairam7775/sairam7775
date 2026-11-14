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

  it("returns an empty table in one request", async () => {
    let calls = 0;
    expect(await selectAll(() => (calls++, Promise.resolve({ data: [], error: null, count: 0 })), 10)).toEqual([]);
    expect(calls).toBe(1);
  });
});
