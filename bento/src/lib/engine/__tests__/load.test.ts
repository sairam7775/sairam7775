import { describe, expect, it } from "vitest";
import { rowToPlace } from "../load";

describe("rowToPlace", () => {
  it("carries a Japanese name from places_public when it exists", () => {
    expect(rowToPlace({ id: "himeji-castle", city_id: "himeji", name: "Himeji Castle", name_ja: "姫路城" }, "deep")).toMatchObject({
      name: "Himeji Castle",
      nameJa: "姫路城",
    });
  });

  it("keeps the Japanese name empty when places_public has none", () => {
    expect(rowToPlace({ id: "garden", city_id: "kyoto-city", name: "Garden" }, "deep").nameJa).toBeNull();
  });
});

describe("rowToPlace position", () => {
  /** places_public.coords as PostgREST sends it: hex EWKB, little-endian,
   *  point with an SRID (4326), longitude then latitude. */
  const ewkb = (lon: number, lat: number) => {
    const b = Buffer.alloc(25);
    b.writeUInt8(1, 0);
    b.writeUInt32LE(0x20000001, 1);
    b.writeUInt32LE(4326, 5);
    b.writeDoubleLE(lon, 9);
    b.writeDoubleLE(lat, 17);
    return b.toString("hex");
  };

  it("reads lat and lon from the coords column", () => {
    expect(rowToPlace({ id: "osk-museum-of-history", city_id: "osaka-city", name: "Museum", coords: ewkb(135.52, 34.683) }, "deep")).toMatchObject({ lat: 34.683, lon: 135.52 });
  });

  it("has no position when coords is missing or not a point", () => {
    expect(rowToPlace({ id: "a", city_id: "c", name: "A" }, "deep")).toMatchObject({ lat: null, lon: null });
    expect(rowToPlace({ id: "a", city_id: "c", name: "A", coords: "POINT(135 34)" }, "deep")).toMatchObject({ lat: null, lon: null });
  });
});
