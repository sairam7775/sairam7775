/** Adult IC fare by distance band, JPY, per operator.
 *
 *  Seed values (spec §10) — the shape is right, the numbers need verifying
 *  against each operator's published table before launch. Bands are
 *  [inclusive upper km, fare]; the last band is a ceiling. */
const BANDS: Record<string, [number, number][]> = {
  "jr-west": [
    [3, 150], [6, 190], [10, 200], [15, 240], [20, 330], [25, 420], [30, 510],
    [35, 590], [40, 680], [45, 770], [50, 860], [60, 990], [70, 1170],
    [80, 1340], [90, 1520], [100, 1690],
  ],
  kintetsu: [
    [3, 180], [6, 240], [10, 300], [14, 360], [18, 430], [22, 490], [26, 560],
    [30, 620], [35, 690], [40, 760], [45, 830], [50, 910],
  ],
  keihan: [[3, 170], [7, 220], [11, 280], [15, 340], [19, 400], [25, 430], [31, 480]],
  "kyoto-subway": [[3, 220], [7, 260], [11, 290], [15, 330], [20, 360]],
  "osaka-metro": [[3, 190], [7, 240], [13, 290], [19, 340], [25, 390]],
  nankai: [[3, 160], [6, 200], [10, 260], [15, 310], [20, 370], [30, 470], [40, 590], [50, 700]],
  /** Tokyo, IC fares checked on the operators' pages, October 2026. They
   *  include the barrier-free surcharge; a Metro–Toei change is charged as
   *  two runs (the ¥70 through discount is not modelled). JR East has no
   *  table yet: its March 2026 fares could not be read. */
  "tokyo-metro": [[6, 178], [11, 209], [19, 252], [27, 293], [40, 324]],
  "toei-subway": [[4, 178], [9, 220], [15, 272], [21, 325], [27, 377], [46, 430]],
  rinkai: [[3, 210], [6, 272], [9, 335], [13, 398]],
  /** Flat fares. */
  hiroden: [[999, 240]],
  "kyoto-bus": [[999, 230]],
  "shinki-bus": [[999, 280]],
};

export function bandFare(operator: string, km: number): number | null {
  const bands = BANDS[operator];
  if (!bands) return null;
  for (const [maxKm, fare] of bands) {
    if (km <= maxKm) return fare;
  }
  return bands[bands.length - 1][1];
}

export function knownOperators(): string[] {
  return Object.keys(BANDS);
}
