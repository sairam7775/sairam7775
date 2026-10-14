/**
 * Enriches seeded cities with Wikidata ids and coordinates.
 *
 * The seed knows a city exists and which prefecture it is in. This fills in
 * where it actually is, from open data, so the planner can reason about
 * distance before any human has curated a single place.
 *
 * Run it locally — it needs network access:
 *
 *   npx tsx scripts/import-geography.ts            # dry run, prints matches
 *   npx tsx scripts/import-geography.ts --apply    # writes them
 *
 * Dry run is the default on purpose. Label matching against Wikidata is
 * fuzzy, and a wrong match silently moves a city hundreds of kilometres —
 * which would corrupt every travel-time estimate built on top of it. Read
 * the output before applying.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

const SPARQL = "https://query.wikidata.org/sparql";
const UA = "BentoGeographyImporter/0.1 (https://github.com/sairam7775)";

/** Wikidata gives coordinates as "Point(long lat)". */
function parsePoint(wkt: string): { lat: number; lon: number } | null {
  const m = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(wkt.trim());
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
}

interface Candidate {
  qid: string;
  label: string;
  lat: number;
  lon: number;
}

/** Ask Wikidata for places in Japan whose Japanese label matches. */
async function lookup(nameJa: string, nameEn: string): Promise<Candidate[]> {
  const query = `
    SELECT ?item ?itemLabel ?coord WHERE {
      ?item wdt:P17 wd:Q17 ;
            wdt:P625 ?coord .
      { ?item rdfs:label "${nameJa}"@ja }
      UNION
      { ?item rdfs:label "${nameEn}"@en }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ja". }
    } LIMIT 5`;

  const res = await fetch(`${SPARQL}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
  });

  if (!res.ok) throw new Error(`Wikidata returned ${res.status} for ${nameEn}`);

  const json = (await res.json()) as {
    results: { bindings: Record<string, { value: string }>[] };
  };

  return json.results.bindings
    .map((b) => {
      const point = parsePoint(b.coord.value);
      if (!point) return null;
      return {
        qid: b.item.value.replace("http://www.wikidata.org/entity/", ""),
        label: b.itemLabel?.value ?? "",
        ...point,
      };
    })
    .filter((c): c is Candidate => c !== null);
}

/** Rough bounds of Japan. A match outside these is wrong, whatever the
 *  label said — this catches same-name places in other countries. */
function inJapan({ lat, lon }: { lat: number; lon: number }): boolean {
  return lat > 20 && lat < 46 && lon > 122 && lon < 154;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: cities, error } = await db
    .from("cities")
    .select("id, name, name_ja, wikidata_id")
    .is("wikidata_id", null)
    .order("id");

  if (error) throw error;
  if (!cities?.length) {
    console.log("Every city already has a Wikidata id. Nothing to do.");
    return;
  }

  console.log(
    `${cities.length} cities to enrich. ${apply ? "APPLYING" : "Dry run — pass --apply to write."}\n`,
  );

  let matched = 0;
  let ambiguous = 0;
  let missed = 0;

  for (const city of cities) {
    // Wikidata asks for one request per second from unauthenticated clients.
    await new Promise((r) => setTimeout(r, 1100));

    let candidates: Candidate[];
    try {
      candidates = (await lookup(city.name_ja ?? city.name, city.name)).filter(inJapan);
    } catch (err) {
      console.log(`  ?  ${city.id.padEnd(18)} lookup failed: ${(err as Error).message}`);
      missed++;
      continue;
    }

    if (candidates.length === 0) {
      console.log(`  –  ${city.id.padEnd(18)} no match`);
      missed++;
      continue;
    }

    const [best] = candidates;
    const flag = candidates.length > 1 ? "?" : "✓";
    if (candidates.length > 1) ambiguous++;

    console.log(
      `  ${flag}  ${city.id.padEnd(18)} ${best.qid.padEnd(10)} ` +
        `${best.lat.toFixed(4)}, ${best.lon.toFixed(4)}  ${best.label}` +
        (candidates.length > 1 ? `   (${candidates.length} candidates — check)` : ""),
    );

    if (apply) {
      const { error: writeError } = await db
        .from("cities")
        .update({
          wikidata_id: best.qid,
          centroid: `SRID=4326;POINT(${best.lon} ${best.lat})`,
        })
        .eq("id", city.id);

      if (writeError) {
        console.log(`     write failed: ${writeError.message}`);
        continue;
      }
    }
    matched++;
  }

  console.log(
    `\n${matched} matched (${ambiguous} with more than one candidate), ${missed} unmatched.`,
  );
  if (!apply) console.log("Nothing was written. Re-run with --apply once the matches look right.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
