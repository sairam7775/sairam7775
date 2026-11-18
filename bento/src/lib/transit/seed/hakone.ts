/** Hakone, hand-seeded: the way in from Tokyo and the classic loop.
 *
 *  The Odakyu Romancecar from Shinjuku and the Tokaido Shinkansen to
 *  Odawara, joined to the Tokyo seed at Shinjuku, Tokyo and Shinagawa; then
 *  the Hakone Tozan Line to Hakone-Yumoto and its mountain train to Gora,
 *  the cable car to Sounzan, the two Hakone Ropeway sections to Owakudani
 *  and Togendai, the Lake Ashi sightseeing ships to Hakone-machi and
 *  Moto-Hakone, and the Tozan bus from Moto-Hakone back to Hakone-Yumoto.
 *  Only stations a visitor needs: skipped stations are counted in `stops`
 *  and their km kept in the hop.
 *
 *  Sources (read November 2026):
 *  - Order and operating km: ja.wikipedia 箱根登山鉄道鉄道線 (Odawara 0.0,
 *    Hakone-Yumoto 6.1, Chokoku-no-Mori 14.3, Gora 15.0),
 *    箱根登山ケーブルカー (1.2 km), 箱根ロープウェイ (Sounzan–Owakudani
 *    1.472 km, Owakudani–Togendai 2.533 km), 小田急小田原線 (Shinjuku–Odawara
 *    82.5 km), 東海道新幹線 (Shinagawa 6.8, Odawara 83.9 from Tokyo). The ships
 *    and the bus have no published km.
 *  - Positions: Wikidata (CC0). Each port stop sits at its port's Wikidata
 *    position; Togendai's port is in the ropeway station's building
 *    (hakonenavi.jp station page: cruise counter B2F, ropeway 1F).
 *  - Minutes and fares: see each line. Where two published figures differ,
 *    the larger is used, as in kanagawa.ts.
 *
 *  Every number here is a SEED VALUE: check minutes and fares against the
 *  operators' timetables before launch, and after each March timetable
 *  change. No ODPT data, no Google Maps data. */
import { bothWays } from "../graph";
import type { Edge, Station } from "../types";

export const stations: Station[] = [
  // ---- Outside Bento's cities: where the Shinkansen meets the Tozan line.
  { id: "odawara", name: "Odawara", nameJa: "小田原", cityId: null, lat: 35.2564, lon: 139.1550, lines: ["Tokaido Shinkansen · Kodama","Hakone Tozan Line · Local"] },
  // ---- Hakone
  { id: "hakone-yumoto", name: "Hakone-Yumoto", nameJa: "箱根湯本", cityId: "hakone", lat: 35.2335, lon: 139.1039, lines: ["Odakyu Romancecar","Hakone Tozan Line · Local","Hakone Tozan Train","Hakone Tozan Bus · H/K"] },
  { id: "chokoku-no-mori", name: "Chokoku-no-Mori", nameJa: "彫刻の森", cityId: "hakone", lat: 35.2465, lon: 139.0508, lines: ["Hakone Tozan Train"] },
  { id: "gora", name: "Gora", nameJa: "強羅", cityId: "hakone", lat: 35.2508, lon: 139.0482, lines: ["Hakone Tozan Train","Hakone Tozan Cable Car"] },
  { id: "sounzan", name: "Sounzan", nameJa: "早雲山", cityId: "hakone", lat: 35.2464, lon: 139.0360, lines: ["Hakone Tozan Cable Car","Hakone Ropeway · Sounzan–Owakudani"] },
  { id: "owakudani", name: "Owakudani", nameJa: "大涌谷", cityId: "hakone", lat: 35.2443, lon: 139.0199, lines: ["Hakone Ropeway · Sounzan–Owakudani","Hakone Ropeway · Owakudani–Togendai"] },
  { id: "togendai", name: "Togendai", nameJa: "桃源台", cityId: "hakone", lat: 35.2379, lon: 138.9950, lines: ["Hakone Ropeway · Owakudani–Togendai","Hakone Sightseeing Cruise"] },
  { id: "hakone-machi-ko", name: "Hakone-machi (port)", nameJa: "箱根町港", cityId: "hakone", lat: 35.1903, lon: 139.0242, lines: ["Hakone Sightseeing Cruise","Hakone Sightseeing Cruise · Hakone-machi–Moto-Hakone"] },
  // The Tozan bus stop Moto-Hakone-ko is at the port.
  { id: "moto-hakone-ko", name: "Moto-Hakone (port)", nameJa: "元箱根港", cityId: "hakone", lat: 35.2010, lon: 139.0300, lines: ["Hakone Sightseeing Cruise","Hakone Sightseeing Cruise · Hakone-machi–Moto-Hakone","Hakone Tozan Bus · H/K"] },
];

const e = (partial: Omit<Edge, "mode"> & { mode?: Edge["mode"] }): Edge => ({ mode: "rail", stops: 1, ...partial });

/** Both directions of a hop whose note only reads right one way (`bothWays`
 *  copies the note): the return gets `back`, or no note at all. */
function outAndBack(out: Edge, back?: string): Edge[] {
  const ret: Edge = { ...out, from: out.to, to: out.from };
  delete ret.note;
  if (back) ret.note = back;
  return [out, ret];
}

const ROMANCECAR = "Odakyu Romancecar";
const KODAMA = "Tokaido Shinkansen · Kodama";
const KODAMA_NOTE = "Only Kodama and some Hikari stop at Odawara; Nozomi don't.";
const TOZAN_LOWER = "Hakone Tozan Line · Local";
const TOZAN = "Hakone Tozan Train";
const CABLE = "Hakone Tozan Cable Car";
const ROPEWAY_1 = "Hakone Ropeway · Sounzan–Owakudani";
const ROPEWAY_2 = "Hakone Ropeway · Owakudani–Togendai";
const ROPEWAY_CHANGE = "Change cabins at Owakudani: the two sections board from different platforms.";
const CRUISE = "Hakone Sightseeing Cruise";
const CRUISE_SHORT = "Hakone Sightseeing Cruise · Hakone-machi–Moto-Hakone";
const BUS = "Hakone Tozan Bus · H/K";

export const edges: Edge[] = [
  // ---- Odakyu Romancecar, Shinjuku – Hakone-Yumoto, running through onto
  // the Tozan line at Odawara. Minutes: about 85 (japan-guide.com, Hakone
  // access, updated October 2025); Odakyu's own pages say about 80, so the
  // larger is used. Fare: ¥1,270 fare + ¥1,200 limited express charge =
  // ¥2,470 (Odakyu's Romancecar page for the charge; the total from
  // japan-guide and Ekitan's Hakone Romancecar guide, August 2026). Stops
  // vary by train: most call at Machida and Odawara, some also at Ebina,
  // Hon-Atsugi or Isehara, and the Super Hakone runs nonstop from Shinjuku
  // to Odawara (59 minutes at fastest since March 2026, Ekitan). The 85
  // minutes and 3 arrivals are kept as the conservative figures for a
  // typical train, not the fastest.
  ...bothWays(e({ from: "shinjuku", to: "hakone-yumoto", line: ROMANCECAR, operator: "odakyu", km: 88.6, minutes: 85, stops: 3, fareJpy: 2470,
    note: "All seats are reserved; the fare shown includes the limited express charge. Stops vary by train." })),

  // ---- Tokaido Shinkansen Kodama to Odawara. Minutes from JR East's
  // timetable for Kodama 813, November 2026: Tokyo 09:27, Shinagawa 09:34,
  // Odawara 10:00. Stops: Shinagawa, Shin-Yokohama, Odawara. JR Central has
  // no fare table here, so the ride is unpriced: the unreserved fare (about
  // ¥3,280 before JR East's March 2026 fare change) could not be confirmed.
  ...bothWays(e({ from: "tokyo", to: "odawara", line: KODAMA, operator: "jr-central", km: 83.9, minutes: 33, stops: 3, note: KODAMA_NOTE })),
  ...bothWays(e({ from: "shinagawa", to: "odawara", line: KODAMA, operator: "jr-central", km: 77.1, minutes: 26, stops: 2, note: KODAMA_NOTE })),

  // ---- Hakone Tozan Line, Odawara – Hakone-Yumoto, all stations (Odakyu
  // trains run it). 15 minutes (Ekitan route search; Visit Kanagawa
  // "approx. 15 minutes"). Exact fare ¥360 (hakonenavi.jp Tozan fare table,
  // hakone-tozan_fee_260730.pdf). It stands alone, so Odawara → Gora is
  // priced ¥360 + ¥460 = ¥820, ¥50 over the through fare of ¥770.
  ...bothWays(e({ from: "odawara", to: "hakone-yumoto", line: TOZAN_LOWER, operator: "hakone-tozan", km: 6.1, minutes: 15, stops: 4, fareJpy: 360 })),

  // ---- Hakone Tozan Train, Hakone-Yumoto – Gora. 8.9 km in about 40
  // minutes (hakonenavi.jp Tozan page; Visit Kanagawa says 35), split by km.
  // Tonosawa, Ohiradai, Miyanoshita and Kowakidani are counted in stops.
  // Fares by band (fares.ts).
  ...outAndBack(e({ from: "hakone-yumoto", to: "chokoku-no-mori", line: TOZAN, operator: "hakone-tozan", km: 8.2, minutes: 38, stops: 5,
    note: "Change at Hakone-Yumoto: the mountain train for Gora leaves from platform 3." })),
  ...bothWays(e({ from: "chokoku-no-mori", to: "gora", line: TOZAN, operator: "hakone-tozan", km: 0.7, minutes: 2 })),

  // ---- Hakone Tozan Cable Car, Gora – Sounzan: 1.2 km in about 10 minutes
  // (hakonenavi.jp), four stops between. Exact fare ¥430 (Tozan fare table).
  ...bothWays(e({ from: "gora", to: "sounzan", line: CABLE, operator: "hakone-tozan", km: 1.2, minutes: 10, stops: 5, fareJpy: 430 })),

  // ---- Hakone Ropeway. Two sections with a change of cabin at Owakudani
  // (hakonenavi.jp ropeway page), so two line names. Minutes: hakonenavi.jp
  // gives about 10 per section (Owakudani – Ubako – Togendai is two);
  // ja.wikipedia gives 8 and 15, so the larger is used. Fare: one flat
  // adult fare of ¥2,000 for any section since 1 October 2025 (hakonenavi.jp
  // fare page), a band in fares.ts so the two sections cost one fare.
  ...bothWays(e({ from: "sounzan", to: "owakudani", line: ROPEWAY_1, operator: "hakone-ropeway", km: 1.5, minutes: 10 })),
  ...outAndBack(e({ from: "owakudani", to: "togendai", line: ROPEWAY_2, operator: "hakone-ropeway", km: 2.5, minutes: 20, stops: 2, note: ROPEWAY_CHANGE }), ROPEWAY_CHANGE),

  // ---- Hakone Sightseeing Cruise on Lake Ashi. The ships run a loop:
  // Togendai → Hakone-machi → Moto-Hakone → Togendai (ja.wikipedia
  // 箱根観光船). Minutes: Togendai → Hakone-machi 30 (japan-guide.com, Lake
  // Ashi, updated October 2025; tabi-mag.jp says 25), Hakone-machi →
  // Moto-Hakone 10 and Moto-Hakone → Togendai 25 (tabi-mag.jp); hakonenavi.jp
  // gives 25–40 minutes from Togendai. Fares since 1 October 2025
  // (hakonenavi.jp cruise page): Togendai to either port ¥1,700,
  // Hakone-machi – Moto-Hakone ¥600. Riding on round the loop is one fare,
  // so the through rides are hops of their own, and the short crossing has
  // its own line name: changing onto it costs the transfer penalty, so a
  // through ride is never priced as two.
  e({ from: "togendai", to: "hakone-machi-ko", line: CRUISE, mode: "ferry", operator: "hakone-cruise", minutes: 30, fareJpy: 1700 }),
  e({ from: "togendai", to: "moto-hakone-ko", line: CRUISE, mode: "ferry", operator: "hakone-cruise", minutes: 40, stops: 2, fareJpy: 1700,
    note: "The ship calls at Hakone-machi first: stay on for Moto-Hakone." }),
  e({ from: "moto-hakone-ko", to: "togendai", line: CRUISE, mode: "ferry", operator: "hakone-cruise", minutes: 25, fareJpy: 1700 }),
  e({ from: "hakone-machi-ko", to: "togendai", line: CRUISE, mode: "ferry", operator: "hakone-cruise", minutes: 35, stops: 2, fareJpy: 1700,
    note: "The ship calls at Moto-Hakone first: stay on for Togendai." }),
  ...bothWays(e({ from: "hakone-machi-ko", to: "moto-hakone-ko", line: CRUISE_SHORT, mode: "ferry", operator: "hakone-cruise", minutes: 10, fareJpy: 600 })),

  // ---- Hakone Tozan Bus, lines H and K, Hakone-Yumoto – Moto-Hakone-ko.
  // Minutes: 40 both ways. Published figures for lines H and K: 35 each
  // way (japan-guide.com, Lake Ashi page, both directions), about 38 by
  // line H (Kanagawa Tourism Association, cedar avenue page), 40 to
  // Onshi-koen-mae, one stop beyond (tabi-mag.jp), 30 by the express bus
  // (Visit Kanagawa). Hakone Shrine's access page gives 60 from Yumoto; it
  // is the one outlier and is not used. Fare ¥1,210 since 1 October 2025 (hakonenavi.jp notices of the
  // Tozan bus fare revision, July and September 2025, ¥1,080 before;
  // japan-guide.com's Lake Ashi page also gives ¥1,210). No km: no source
  // gives the road distance.
  e({ from: "hakone-yumoto", to: "moto-hakone-ko", line: BUS, mode: "bus", operator: "hakone-tozan-bus", minutes: 40, fareJpy: 1210,
    note: "Lines H or K from the bus stands at Hakone-Yumoto Station. Get off at Moto-Hakone-ko." }),
  e({ from: "moto-hakone-ko", to: "hakone-yumoto", line: BUS, mode: "bus", operator: "hakone-tozan-bus", minutes: 40, fareJpy: 1210 }),
];
