/** Adult IC fare by distance band, JPY, per operator.
 *
 *  Seed values (spec §10) — the shape is right, the numbers need verifying
 *  against each operator's published table before launch. Bands are
 *  [inclusive upper km, fare]; a ride past the last band is unpriced
 *  (null), never charged the last band. */
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
   *  two runs (the ¥70 through discount is not modelled). */
  "tokyo-metro": [[6, 178], [11, 209], [19, 252], [27, 293], [40, 324]],
  "toei-subway": [[4, 178], [9, 220], [15, 272], [21, 325], [27, 377], [46, 430]],
  rinkai: [[3, 210], [6, 272], [9, 335], [13, 398]],
  /** JR East trunk lines (幹線), IC fares from 14 March 2026, when the
   *  cheaper Yamanote and Tokyo-area tables were folded into this one, so
   *  it covers every JR East ride in the Tokyo and Kanagawa seeds. JR
   *  East's own pages refuse automated reads, so: the ticket fares per band
   *  from jr-group.jp/higashinihon-fare/ ("2026年3月改定"), and the IC fare
   *  of each band (a few yen less) from published IC fares from Tokyo,
   *  tairayukiblog.hatenablog.jp (2026-01-11 and 2026-01-21, e.g. Yokohama
   *  528, Kamakura 1,034, Hiratsuka 1,221, Narita Airport 1,408, Kimitsu
   *  1,595, Yorii 1,782); each matches its ticket band. Read November 2026.
   *  Fractional km round up, as JR's do (bandFare's inclusive upper km).
   *  Not modelled, so a figure can be a little off:
   *  - JR East kept 12 special-fare sections after March 2026, not named in
   *    the sources found, so a pair such as Tokyo–Yokohama may differ
   *    (Tokyo–Odawara is one such fare);
   *  - in the Tokyo area JR charges by the shortest route, while Bento sums
   *    the km actually ridden;
   *  - limited express charges: the Narita Express carries its whole fare on
   *    its edges, so a JR ride onto it is priced as two tickets (slightly
   *    high).
   *  A ride past 100 km is unpriced. */
  "jr-east": [
    [3, 155], [6, 199], [10, 209], [15, 253], [20, 341], [25, 440], [30, 528],
    [35, 616], [40, 715], [45, 803], [50, 902], [60, 1034], [70, 1221],
    [80, 1408], [90, 1595], [100, 1782],
  ],
  /** Kanagawa (Yokohama and Kamakura), from the operators' own fare pages,
   *  November 2026. Each band table reproduces every station pair of the
   *  operator's published table, using ja.wikipedia's operating km.
   *  Minatomirai Line: IC fares (¥200 / ¥230 by ticket), 2023-03-18 table at
   *  mm21railway.co.jp/info/ticket.html; the ¥20 change discount with some
   *  Tokyu, Keikyu and Sotetsu stations is not modelled. Enoden: the one fare
   *  enoden.co.jp/train/fare/ publishes. JR East, Tokyu and Keikyu Bus have
   *  no table. The Blue Line and city bus rides carry exact fares on their
   *  edges in seed/kanagawa.ts. */
  minatomirai: [[3, 193], [5, 224]],
  enoden: [[2, 200], [4, 220], [7, 260], [10, 310]],
  /** Flat fares. */
  hiroden: [[999, 240]],
  "kyoto-bus": [[999, 230]],
  "shinki-bus": [[999, 280]],
};

export function bandFare(operator: string, km: number): number | null {
  const bands = BANDS[operator];
  if (!bands) return null;
  // Operating km are published to 0.1 km; summing hops in floating point
  // can land just past a band edge (6.000000000000001), so round first.
  const rounded = Math.round(km * 10) / 10;
  for (const [maxKm, fare] of bands) {
    if (rounded <= maxKm) return fare;
  }
  // Past the end of the table: no price Bento can stand behind, so the
  // ride counts as unpriced rather than charged the last band.
  return null;
}

export function knownOperators(): string[] {
  return Object.keys(BANDS);
}
