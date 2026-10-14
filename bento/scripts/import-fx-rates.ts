/**
 * Refreshes fx_rates from the European Central Bank's reference rates,
 * via Frankfurter (https://frankfurter.dev — free, no key).
 *
 * The vault stores a foreign cost in its own currency and converts on
 * read, so this table is the only place a rate lives. Re-run it whenever
 * the totals should be fresher; the vault prints the date of the oldest
 * rate it used.
 *
 *   npx tsx scripts/import-fx-rates.ts            # dry run, prints rates
 *   npx tsx scripts/import-fx-rates.ts --apply    # writes them
 *
 * Asked against EUR rather than JPY: Frankfurter rounds to five places,
 * and a yen-based quote of 0.00564 EUR is 0.1% coarse before anyone
 * multiplies it by a hotel bill.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

const SOURCE = "https://api.frankfurter.dev/v1/latest?base=EUR";

async function main() {
  const apply = process.argv.includes("--apply");

  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Frankfurter answered ${res.status}`);
  const body = (await res.json()) as { date: string; rates: Record<string, number> };

  const jpyPerEur = body.rates.JPY;
  if (!jpyPerEur) throw new Error("No JPY rate in the response; refusing to write anything.");

  const fetchedAt = new Date(`${body.date}T00:00:00Z`).toISOString();
  const rows = [
    { currency: "JPY", jpy_per_unit: 1, fetched_at: fetchedAt },
    { currency: "EUR", jpy_per_unit: Number(jpyPerEur.toFixed(6)), fetched_at: fetchedAt },
    ...Object.entries(body.rates)
      .filter(([c]) => c !== "JPY")
      .map(([currency, perEur]) => ({ currency, jpy_per_unit: Number((jpyPerEur / perEur).toFixed(6)), fetched_at: fetchedAt })),
  ];

  console.log(`ECB reference rates for ${body.date}, yen per unit:\n`);
  for (const r of rows) console.log(`  ${r.currency}  ${r.jpy_per_unit}`);

  if (!apply) {
    console.log(`\nDry run. Re-run with --apply to write ${rows.length} rates.`);
    return;
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });

  const { error } = await db.from("fx_rates").upsert(rows, { onConflict: "currency" });
  if (error) throw error;
  console.log(`\nWrote ${rows.length} rates.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
