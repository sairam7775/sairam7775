import { describe, expect, it } from "vitest";
import { vaultTotal, type Costed, type FxRate } from "../money";

const yen = (n: number): Costed => ({ costJpy: n, costAmount: n, costCurrency: "JPY" });
const foreign = (amount: number, currency: string): Costed => ({ costJpy: null, costAmount: amount, costCurrency: currency });

const rates: FxRate[] = [
  { currency: "JPY", jpyPerUnit: 1, fetchedAt: "2026-10-01T00:00:00Z" },
  { currency: "USD", jpyPerUnit: 150, fetchedAt: "2026-10-10T00:00:00Z" },
  { currency: "EUR", jpyPerUnit: 160, fetchedAt: "2026-10-05T00:00:00Z" },
];

describe("vaultTotal", () => {
  it("sums yen without calling it a conversion", () => {
    const t = vaultTotal([yen(12000), yen(3400)], rates);
    expect(t).toEqual({ jpy: 15400, converted: false, oldestRateAt: null, missing: [] });
  });

  it("converts on read and reports the oldest rate it used", () => {
    const t = vaultTotal([yen(1000), foreign(100, "USD"), foreign(10, "eur")], rates);
    expect(t.jpy).toBe(1000 + 15000 + 1600);
    expect(t.converted).toBe(true);
    expect(t.oldestRateAt).toBe("2026-10-05T00:00:00Z");
  });

  it("names a currency it has no rate for instead of guessing", () => {
    const t = vaultTotal([yen(500), foreign(80, "GBP"), foreign(20, "GBP")], rates);
    expect(t.jpy).toBe(500);
    expect(t.missing).toEqual([{ currency: "GBP", amount: 100 }]);
  });

  it("reads an amount with no currency as yen", () => {
    expect(vaultTotal([{ costJpy: null, costAmount: 2500.4, costCurrency: null }], []).jpy).toBe(2500);
  });

  it("skips bookings with no cost", () => {
    expect(vaultTotal([{ costJpy: null, costAmount: null, costCurrency: "USD" }], rates).jpy).toBe(0);
  });
});
