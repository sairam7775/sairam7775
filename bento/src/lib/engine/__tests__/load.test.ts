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
