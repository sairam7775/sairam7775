/** What starting a ready-made trip reads before there is a trip: city
 *  coverage from `city_coverage` (the traveller-safe view), places from
 *  `places_public`, and the train graph. The same reads as SupabaseStore's
 *  `cities()` and `places()`, without a trip id; change them together. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToPlace } from "@/lib/engine/load";
import { hubFor, type CityFacts } from "@/lib/engine/route";
import type { PlaceInput } from "@/lib/engine/types";
import { loadGraph } from "@/lib/transit/load";
import type { Graph } from "@/lib/transit/graph";
import { selectAll } from "@/lib/supabase/select-all";
import type { CoverageTier } from "@/lib/types";
import type { ReadyMadeStartDeps } from "./start";

type Catalogue = ReadyMadeStartDeps["catalogue"];

export class SupabaseCatalogue implements Catalogue {
  private citiesCache: Promise<CityFacts[]> | null = null;

  constructor(private readonly db: SupabaseClient) {}

  graph(): Promise<Graph> {
    return loadGraph();
  }

  cities(): Promise<CityFacts[]> {
    return this.citiesCache ??= this.loadCities().catch((error) => {
      this.citiesCache = null;
      throw error;
    });
  }

  private async loadCities(): Promise<CityFacts[]> {
    const [data, graph] = await Promise.all([
      selectAll((from, to) =>
        this.db.from("city_coverage").select("city_id, name, coverage_tier, transit_note, verified_places", { count: "exact" }).order("city_id").range(from, to),
      ),
      this.graph(),
    ]);
    return data.map((c) => ({
      id: c.city_id,
      name: c.name,
      tier: c.coverage_tier as CoverageTier,
      verifiedPlaces: Number(c.verified_places ?? 0),
      transitNote: c.transit_note ?? null,
      hubStation: hubFor(c.city_id, graph),
    }));
  }

  async places(cityId: string): Promise<PlaceInput[]> {
    const [cities, data] = await Promise.all([
      this.cities(),
      selectAll((from, to) => this.db.from("places_public").select("*", { count: "exact" }).eq("city_id", cityId).order("id").range(from, to)),
    ]);
    const tier = cities.find((c) => c.id === cityId)?.tier ?? "stub";
    return data.map((r) => rowToPlace(r, tier));
  }
}
