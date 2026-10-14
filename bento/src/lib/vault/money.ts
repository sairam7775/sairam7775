/** What the vault's bookings add up to, in yen.
 *
 *  Pure. Costs are stored in their own currency and converted here, on
 *  read, so a stale rate is never baked into a row. A currency with no
 *  rate is named, not guessed and not silently dropped from the sum. */

export interface FxRate {
  currency: string;
  jpyPerUnit: number;
  fetchedAt: string;
}

export interface Costed {
  costJpy: number | null;
  costAmount: number | null;
  costCurrency: string | null;
}

export interface VaultTotal {
  /** Everything that could be summed, in yen. */
  jpy: number;
  /** True when any part of `jpy` came through a rate rather than yen. */
  converted: boolean;
  /** The oldest rate used, so the page can say how stale the sum is. */
  oldestRateAt: string | null;
  /** Currencies with no rate on record, with what was left out. */
  missing: { currency: string; amount: number }[];
}

export function vaultTotal(bookings: Costed[], rates: FxRate[]): VaultTotal {
  const byCurrency = new Map(rates.map((r) => [r.currency.toUpperCase(), r]));
  const missing = new Map<string, number>();
  let jpy = 0;
  let converted = false;
  let oldestRateAt: string | null = null;

  for (const b of bookings) {
    if (b.costJpy != null) {
      jpy += b.costJpy;
      continue;
    }
    if (b.costAmount == null) continue;
    // A bare amount with no currency was typed into a Japanese booking form;
    // the form's placeholder is JPY, so that is what it means.
    const currency = (b.costCurrency ?? "JPY").toUpperCase();
    if (currency === "JPY") {
      jpy += Math.round(b.costAmount);
      continue;
    }
    const rate = byCurrency.get(currency);
    if (!rate) {
      missing.set(currency, (missing.get(currency) ?? 0) + b.costAmount);
      continue;
    }
    jpy += Math.round(b.costAmount * rate.jpyPerUnit);
    converted = true;
    if (!oldestRateAt || rate.fetchedAt < oldestRateAt) oldestRateAt = rate.fetchedAt;
  }

  return {
    jpy,
    converted,
    oldestRateAt,
    missing: [...missing].map(([currency, amount]) => ({ currency, amount })),
  };
}
