import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkBackgroundText, loadBackgrounds, withBackgrounds } from "./backgrounds";

const ok = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";

describe("checkBackgroundText", () => {
  it("passes a lasting story", () => expect(checkBackgroundText(ok)).toBeNull());

  it("refuses short and long text", () => {
    expect(checkBackgroundText("Old temple.")).toMatch(/120/);
    expect(checkBackgroundText("x".repeat(901))).toMatch(/900/);
  });

  it("refuses a clock time or a price", () => {
    expect(checkBackgroundText(`${ok} Open 9:00 daily.`)).toMatch(/time/);
    expect(checkBackgroundText(`${ok} Entry is ¥500.`)).toMatch(/price/);
    expect(checkBackgroundText(`${ok} Entry is 500 yen.`)).toMatch(/price/);
  });
});

/** Only the query surface loadBackgrounds uses: from().select().in(). */
function fakeDb(rows: unknown[] | null, error: Error | null = null) {
  const from = vi.fn(() => ({ select: () => ({ in: async () => ({ data: rows, error }) }) }));
  return { db: { from } as unknown as SupabaseClient, from };
}

describe("loadBackgrounds", () => {
  it("does not query for no ids", async () => {
    const { db, from } = fakeDb([]);
    expect((await loadBackgrounds(db, [])).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("maps rows by place id", async () => {
    const { db, from } = fakeDb([{ place_id: "kyt-kinkakuji", body: ok, sources: ["shokoku-ji.jp"] }]);
    const map = await loadBackgrounds(db, ["kyt-kinkakuji"]);
    expect(map.get("kyt-kinkakuji")).toEqual({ placeId: "kyt-kinkakuji", body: ok, sources: ["shokoku-ji.jp"] });
    expect(from).toHaveBeenCalledWith("place_backgrounds_public");
  });

  it("returns an empty map on a read error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb(null, new Error("down"));
    await expect(loadBackgrounds(db, ["kyt-kinkakuji"])).resolves.toEqual(new Map());
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("withBackgrounds", () => {
  it("gives each stop its checked background, or null", () => {
    const map = new Map([["kyt-kinkakuji", { placeId: "kyt-kinkakuji", body: ok, sources: ["shokoku-ji.jp"] }]]);
    const items = [{ placeId: "kyt-kinkakuji", name: "Kinkaku-ji" }, { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera" }];
    expect(withBackgrounds(items, map)).toEqual([
      { placeId: "kyt-kinkakuji", name: "Kinkaku-ji", background: ok },
      { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", background: null },
    ]);
  });
});

describe("checkBackgroundText, the formats people write", () => {
  it.each(["Open 9am to 5pm.", "Gates open at 9 a.m. each day.", "Open 8.30 to 17.00.", "開門は9時から17時まで。", "Open ９:００ daily."])(
    "refuses the clock time in %s",
    (t) => expect(checkBackgroundText(`${ok} ${t}`)).toMatch(/time/),
  );
  it.each(["Entry is ￥500.", "Entry is 500 JPY.", "Entry is 500円."])(
    "refuses the price in %s",
    (t) => expect(checkBackgroundText(`${ok} ${t}`)).toMatch(/price/),
  );
  it("keeps a Japanese name that contains 円", () => {
    expect(checkBackgroundText("Maruyama Park (円山公園) opened in 1886 as Kyoto's oldest public park, laid out around a weeping cherry tree that draws crowds every spring.")).toBeNull();
  });
});
