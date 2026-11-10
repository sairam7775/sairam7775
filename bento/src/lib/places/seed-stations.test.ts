import { describe, expect, it } from "vitest";
import { stations as kansaiStations } from "@/lib/transit/seed/kansai-sanyo";
import { stations as tokyoStations } from "@/lib/transit/seed/tokyo";
import { himeji } from "./seed/himeji";
import { hiroshima } from "./seed/hiroshima";
import { kyoto } from "./seed/kyoto";
import { miyajima } from "./seed/miyajima";
import { nara } from "./seed/nara";
import { osaka } from "./seed/osaka";
import { tokyo } from "./seed/tokyo";

const all = [...kyoto, ...osaka, ...nara, ...hiroshima, ...miyajima, ...himeji, ...tokyo];
const stationsById = new Map([...kansaiStations, ...tokyoStations].map((s) => [s.id, s]));

describe("place stations in the seed", () => {
  // The exporter writes the station id as it is, so a typo would only fail
  // when the SQL hits the stations foreign key. Catch it here instead.
  it("names only stations that are in the transit seed", () => {
    const missing = all.filter((p) => p.station && !stationsById.has(p.station)).map((p) => `${p.id} → ${p.station}`);
    expect(missing).toEqual([]);
  });

  it("names a station in the place's own city", () => {
    const elsewhere = all
      .filter((p) => p.station && stationsById.has(p.station) && stationsById.get(p.station)!.cityId !== p.city)
      .map((p) => `${p.id} (${p.city}) → ${p.station} (${stationsById.get(p.station!)!.cityId})`);
    expect(elsewhere).toEqual([]);
  });

  it("gives a walk time whenever it names a station", () => {
    const noWalk = all.filter((p) => p.station && (p.walk == null || p.walk <= 0)).map((p) => p.id);
    expect(noWalk).toEqual([]);
  });
});
