/**
 * Turns the drafted place seeds into SQL.
 *
 *   npx tsx scripts/export-places-seed.ts > supabase/seed_places_draft.sql
 *
 * Every row lands as a draft. Re-running refreshes DRAFT rows only: a
 * record a human has verified is never overwritten by a re-export — the
 * signature stands until someone withdraws it in /admin. The SQL is built
 * (and the seeds checked) by src/lib/places/export-sql.ts.
 */
import { allPlaces as all } from "../src/lib/places/seed";
import { placesSeedSql } from "../src/lib/places/export-sql";

const sql = placesSeedSql(all);
process.stdout.write(sql);
console.error(`${all.length} drafts across ${new Set(all.map((p) => p.city)).size} cities`);
