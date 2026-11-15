/** Kanagawa: Yokohama and Kamakura (with Enoshima), hand-seeded.
 *
 *  A small network for the drafted Yokohama and Kamakura places, joined to
 *  the Tokyo seed at Tokyo, Shimbashi, Shinagawa and Shibuya. Only what a
 *  visitor rides: every station serves a place, joins two lines, or is
 *  where a line ends. Skipped stations are counted in `stops` and their km
 *  kept in the hop, so no station is added just for its distance. Hakone
 *  goes later in this file.
 *
 *  Sources (the full list, with dates, is kept outside the repo):
 *  - Station order and operating km: each line's station table on
 *    ja.wikipedia (横須賀線, 横須賀・総武快速線, 東海道線 (JR東日本), 根岸線,
 *    東急東横線, 横浜高速鉄道みなとみらい線, 横浜市営地下鉄ブルーライン,
 *    江ノ島電鉄線), read November 2026.
 *  - Positions: Wikidata (CC0). The two bus stops have no Wikidata item;
 *    their positions are from MLIT's National Land Numerical Information
 *    bus stop data (国土数値情報 バス停留所データ P11, 2022, CC BY 4.0;
 *    出典：国土数値情報（バス停留所データ）（国土交通省）).
 *  - Minutes: see each line. Where a line publishes an end-to-end time it
 *    is apportioned by km plus a 0.5-minute dwell per intermediate stop,
 *    rounded so the line total still matches. JR East's own pages were not
 *    used, so the JR minutes are HAND-SET.
 *  - Fares: only from the operators' own fare pages (see fares.ts). JR
 *    East, Tokyu and Keikyu Bus have no table, so their rides count as
 *    unpriced, never free.
 *
 *  Every number here is a SEED VALUE: check minutes and fares against the
 *  operators' timetables before launch, and after each March timetable
 *  change. No ODPT data, no Google Maps data. */
import { bothWays } from "../graph";
import type { Edge, Station } from "../types";

export const stations: Station[] = [
  // ---- Yokohama
  { id: "yokohama", name: "Yokohama", nameJa: "横浜", cityId: "yokohama", lat: 35.4658, lon: 139.6228, lines: ["JR Tokaido Line","JR Yokosuka Line","JR Negishi Line","Tokyu Toyoko Line","Minatomirai Line","Yokohama Subway Blue Line"] },
  { id: "shin-takashima", name: "Shin-Takashima", nameJa: "新高島", cityId: "yokohama", lat: 35.4619, lon: 139.6269, lines: ["Minatomirai Line"] },
  { id: "minatomirai", name: "Minatomirai", nameJa: "みなとみらい", cityId: "yokohama", lat: 35.4579, lon: 139.6323, lines: ["Minatomirai Line"] },
  { id: "bashamichi", name: "Bashamichi", nameJa: "馬車道", cityId: "yokohama", lat: 35.4501, lon: 139.6364, lines: ["Minatomirai Line"] },
  { id: "nihon-odori", name: "Nihon-odori", nameJa: "日本大通り", cityId: "yokohama", lat: 35.4468, lon: 139.6426, lines: ["Minatomirai Line"] },
  { id: "motomachi-chukagai", name: "Motomachi-Chukagai", nameJa: "元町・中華街", cityId: "yokohama", lat: 35.4422, lon: 139.6508, lines: ["Minatomirai Line"] },
  { id: "sakuragicho", name: "Sakuragicho", nameJa: "桜木町", cityId: "yokohama", lat: 35.4508, lon: 139.6311, lines: ["JR Negishi Line"] },
  { id: "kannai", name: "Kannai", nameJa: "関内", cityId: "yokohama", lat: 35.4433, lon: 139.6371, lines: ["JR Negishi Line"] },
  { id: "ishikawacho", name: "Ishikawacho", nameJa: "石川町", cityId: "yokohama", lat: 35.4383, lon: 139.6431, lines: ["JR Negishi Line"] },
  { id: "negishi", name: "Negishi", nameJa: "根岸", cityId: "yokohama", lat: 35.4158, lon: 139.6350, lines: ["JR Negishi Line","Yokohama City Bus"] },
  // For Sankeien: a 10-minute walk from this stop (Sankeien's access page).
  { id: "honmoku", name: "Honmoku (bus)", nameJa: "本牧", cityId: "yokohama", lat: 35.4224, lon: 139.6648, lines: ["Yokohama City Bus"] },
  { id: "shin-yokohama", name: "Shin-Yokohama", nameJa: "新横浜", cityId: "yokohama", lat: 35.5075, lon: 139.6175, lines: ["Yokohama Subway Blue Line"] },
  // ---- Kamakura. Ofuna station is in Kamakura city (ja.wikipedia 横須賀線).
  { id: "ofuna", name: "Ofuna", nameJa: "大船", cityId: "kamakura", lat: 35.3533, lon: 139.5311, lines: ["JR Tokaido Line","JR Yokosuka Line"] },
  { id: "kita-kamakura", name: "Kita-Kamakura", nameJa: "北鎌倉", cityId: "kamakura", lat: 35.3381, lon: 139.5444, lines: ["JR Yokosuka Line"] },
  { id: "kamakura", name: "Kamakura", nameJa: "鎌倉", cityId: "kamakura", lat: 35.3191, lon: 139.5504, lines: ["JR Yokosuka Line","Enoden Line","Keikyu Bus"] },
  { id: "hase", name: "Hase", nameJa: "長谷", cityId: "kamakura", lat: 35.3114, lon: 139.5364, lines: ["Enoden Line"] },
  // For Hokoku-ji: a 3-minute walk from this stop (Hokoku-ji's access page).
  { id: "jomyoji", name: "Jomyoji (bus)", nameJa: "浄明寺", cityId: "kamakura", lat: 35.3212, lon: 139.5703, lines: ["Keikyu Bus"] },
  // Enoshima is in Fujisawa city, but Bento files the island's places under
  // Kamakura, and a place's station must be in the place's own city.
  { id: "enoshima", name: "Enoshima", nameJa: "江ノ島", cityId: "kamakura", lat: 35.3111, lon: 139.4875, lines: ["Enoden Line"] },
  // ---- Outside Bento's cities: where the Enoden meets the Tokaido Line.
  { id: "fujisawa", name: "Fujisawa", nameJa: "藤沢", cityId: null, lat: 35.3372, lon: 139.4872, lines: ["JR Tokaido Line","Enoden Line"] },
];

const e = (partial: Omit<Edge, "mode"> & { mode?: Edge["mode"] }): Edge => ({ mode: "rail", stops: 1, ...partial });

const YOKOSUKA = "JR Yokosuka Line";
const TOKAIDO = "JR Tokaido Line";
const TOYOKO = "Tokyu Toyoko Line · Limited Express";
const TOYOKO_NOTE = "Most trains run through onto the Minatomirai Line: stay on for Minatomirai and Motomachi-Chukagai.";
const MINATOMIRAI = "Minatomirai Line · Local";
const NEGISHI = "JR Negishi Line";
const NEGISHI_NOTE = "Keihin-Tohoku Line trains from Tokyo run through onto this line.";
const ENODEN = "Enoden Line";

export const edges: Edge[] = [
  // ---- JR Yokosuka Line: Tokyo – Kamakura, every train stops at every
  // station. Km are fare km: between Shinagawa and Yokohama the trains run
  // by the Hinkaku line, 2.9 km longer, but fares use the Tokaido km (22.0),
  // as ja.wikipedia 横須賀・総武快速線 explains. Minutes HAND-SET, to verify:
  // Tokyo – Kamakura 55. Cross-checks: Hokoku-ji's access page gives about
  // 60 minutes from Tokyo and about 50 from Shinagawa; ja.wikipedia says
  // this line takes 5 minutes longer than the Tokaido Line from Shinagawa to
  // Yokohama, and 15–18 minutes from Yokohama to Ofuna (根岸線).
  ...bothWays(e({ from: "tokyo", to: "shimbashi", line: YOKOSUKA, operator: "jr-east", km: 1.9, minutes: 3,
    note: "Leaves Tokyo from the underground Yokosuka and Sobu Line platforms." })),
  ...bothWays(e({ from: "shimbashi", to: "shinagawa", line: YOKOSUKA, operator: "jr-east", km: 4.9, minutes: 6 })),
  ...bothWays(e({ from: "shinagawa", to: "yokohama", line: YOKOSUKA, operator: "jr-east", km: 22.0, minutes: 22, stops: 4 })),
  ...bothWays(e({ from: "yokohama", to: "ofuna", line: YOKOSUKA, operator: "jr-east", km: 17.7, minutes: 18, stops: 4 })),
  ...bothWays(e({ from: "ofuna", to: "kita-kamakura", line: YOKOSUKA, operator: "jr-east", km: 2.3, minutes: 3 })),
  ...bothWays(e({ from: "kita-kamakura", to: "kamakura", line: YOKOSUKA, operator: "jr-east", km: 2.2, minutes: 3 })),

  // ---- JR Tokaido Line, local trains (they stop at every station in the
  // table: Kawasaki and Totsuka are skipped here, counted in stops).
  // Minutes HAND-SET, to verify: Tokyo – Yokohama 25, Yokohama – Ofuna 16
  // (ja.wikipedia 根岸線: 15–18 minutes by Tokaido or Yokosuka Line).
  ...bothWays(e({ from: "tokyo", to: "shimbashi", line: TOKAIDO, operator: "jr-east", km: 1.9, minutes: 3 })),
  ...bothWays(e({ from: "shimbashi", to: "shinagawa", line: TOKAIDO, operator: "jr-east", km: 4.9, minutes: 5 })),
  ...bothWays(e({ from: "shinagawa", to: "yokohama", line: TOKAIDO, operator: "jr-east", km: 22.0, minutes: 17, stops: 2 })),
  // With these hand-set minutes, Tokaido to Ofuna and a change beats the
  // direct Yokosuka Line train to Kamakura by 3 minutes, which is within
  // their error; the note points out the train with no change.
  e({ from: "yokohama", to: "ofuna", line: TOKAIDO, operator: "jr-east", km: 17.7, minutes: 16, stops: 2,
    note: "For Kita-Kamakura and Kamakura, the Yokosuka Line runs there from Tokyo without a change." }),
  e({ from: "ofuna", to: "yokohama", line: TOKAIDO, operator: "jr-east", km: 17.7, minutes: 16, stops: 2 }),
  ...bothWays(e({ from: "ofuna", to: "fujisawa", line: TOKAIDO, operator: "jr-east", km: 4.6, minutes: 4 })),

  // ---- Tokyu Toyoko Line Limited Express, running through onto the
  // Minatomirai Line. One line name for the whole run, because it is one
  // train; the operator changes at Yokohama, so the fares stay two. Stops
  // from ja.wikipedia's tables (Naka-meguro, Jiyugaoka, Musashi-Kosugi,
  // Kikuna, Yokohama; then Minatomirai and Motomachi-Chukagai). Minutes:
  // Yokohama Minatomirai Railway gives about 35 minutes from Motomachi-
  // Chukagai to Shibuya and about 7 to Yokohama in the daytime, so
  // Shibuya – Yokohama is 28 (ja.wikipedia: 26 at fastest); the 7 is split
  // by km.
  ...bothWays(e({ from: "shibuya", to: "yokohama", line: TOYOKO, operator: "tokyu", km: 24.2, minutes: 28, stops: 5,
    note: `${TOYOKO_NOTE} On weekday mornings and evenings the Commuter Limited Express runs instead and also stops at Hiyoshi.` })),
  ...bothWays(e({ from: "yokohama", to: "minatomirai", line: TOYOKO, operator: "minatomirai", km: 1.7, minutes: 3,
    note: "Limited Expresses skip Shin-Takashima, Bashamichi and Nihon-odori: change to a Local for those." })),
  ...bothWays(e({ from: "minatomirai", to: "motomachi-chukagai", line: TOYOKO, operator: "minatomirai", km: 2.4, minutes: 4, stops: 1 })),

  // ---- Minatomirai Line, Local (every station). The operator's daytime
  // "about 7 minutes" Motomachi-Chukagai – Yokohama, split by km and dwell.
  ...bothWays(e({ from: "yokohama", to: "shin-takashima", line: MINATOMIRAI, operator: "minatomirai", km: 0.8, minutes: 1 })),
  ...bothWays(e({ from: "shin-takashima", to: "minatomirai", line: MINATOMIRAI, operator: "minatomirai", km: 0.9, minutes: 2 })),
  ...bothWays(e({ from: "minatomirai", to: "bashamichi", line: MINATOMIRAI, operator: "minatomirai", km: 0.9, minutes: 2 })),
  ...bothWays(e({ from: "bashamichi", to: "nihon-odori", line: MINATOMIRAI, operator: "minatomirai", km: 0.6, minutes: 1 })),
  ...bothWays(e({ from: "nihon-odori", to: "motomachi-chukagai", line: MINATOMIRAI, operator: "minatomirai", km: 0.9, minutes: 1 })),

  // ---- JR Negishi Line, Yokohama – Negishi (Yamate skipped, counted in
  // stops). ja.wikipedia: Yokohama – Ofuna about 30 minutes over 22.1 km,
  // split by km and dwell.
  ...bothWays(e({ from: "yokohama", to: "sakuragicho", line: NEGISHI, operator: "jr-east", km: 2.0, minutes: 3, note: NEGISHI_NOTE })),
  ...bothWays(e({ from: "sakuragicho", to: "kannai", line: NEGISHI, operator: "jr-east", km: 1.0, minutes: 1, note: NEGISHI_NOTE })),
  ...bothWays(e({ from: "kannai", to: "ishikawacho", line: NEGISHI, operator: "jr-east", km: 0.8, minutes: 2, note: NEGISHI_NOTE })),
  ...bothWays(e({ from: "ishikawacho", to: "negishi", line: NEGISHI, operator: "jr-east", km: 3.3, minutes: 5, stops: 2, note: NEGISHI_NOTE })),

  // ---- Yokohama Municipal Subway Blue Line, all-stations trains. Minutes:
  // ja.wikipedia gives 69 minutes for the whole line (40.4 km), split by km
  // and dwell. Fare: the exact IC fare from the city's fare table (¥242;
  // ¥250 by ticket), so no band table is needed for one ride.
  ...bothWays(e({ from: "yokohama", to: "shin-yokohama", line: "Yokohama Subway Blue Line", operator: "yokohama-subway", km: 7.0, minutes: 11, stops: 5, fareJpy: 242,
    note: "Some Rapid trains run nonstop in 8 minutes." })),

  // ---- Enoden: Kamakura – Hase – Enoshima – Fujisawa, one train stopping
  // everywhere. ja.wikipedia: 37 minutes end to end since 18 March 2023,
  // split by km and dwell (the single track's passing waits are spread
  // evenly, so a part of the line may be a minute or two off).
  ...bothWays(e({ from: "kamakura", to: "hase", line: ENODEN, operator: "enoden", km: 1.7, minutes: 6, stops: 3 })),
  ...bothWays(e({ from: "hase", to: "enoshima", line: ENODEN, operator: "enoden", km: 5.0, minutes: 18, stops: 6 })),
  ...bothWays(e({ from: "enoshima", to: "fujisawa", line: ENODEN, operator: "enoden", km: 3.3, minutes: 13, stops: 5 })),

  // ---- Buses, stops modelled as stations as Kyoto's are. No km: no source
  // gives the road distance.
  // Hokoku-ji's access page: Keikyu bus from stand 4 at Kamakura Station
  // East Exit, about 12 minutes to Jomyoji. Keikyu Bus publishes fares only
  // through a journey-search tool, so this ride is unpriced.
  ...bothWays(e({ from: "kamakura", to: "jomyoji", line: "Keikyu Bus", mode: "bus", operator: "keikyu-bus", minutes: 12,
    note: "From stand 4 at the East Exit: buses for Kamakura Reien, Kanazawa-hakkei or Highland. Get off at Jomyoji." })),
  // Sankeien's access page: city bus 58 or 101 from stand 1 at Negishi,
  // 10 minutes to Honmoku. Yokohama City Bus's flat fare, ¥220 cash or IC.
  ...bothWays(e({ from: "negishi", to: "honmoku", line: "Yokohama City Bus · 58/101", mode: "bus", operator: "yokohama-city-bus", minutes: 10, fareJpy: 220,
    note: "From stand 1 at Negishi Station. Get off at Honmoku." })),
];
