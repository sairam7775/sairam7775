/** The Kansai–Sanyo corridor, hand-seeded (D15).
 *
 *  This is the spec's named fallback for P3: the deep-tier cities get a
 *  real graph today, and the GTFS importer replaces it with feed data when
 *  run. Every number here is a SEED VALUE — the shape is right; minutes
 *  and fares need verifying against timetables before launch (§10).
 *
 *  One source of truth: the tests route over this, the CLI routes over
 *  this, and scripts/export-transit-seed.ts turns it into SQL. */
import { bothWays } from "../graph";
import type { Edge, Station } from "../types";

export const stations: Station[] = [
  // Kyoto
  { id: "kyoto", name: "Kyoto", nameJa: "京都", cityId: "kyoto-city", lat: 34.9858, lon: 135.7588,
    lines: ["Tokaido Shinkansen", "JR Kyoto Line", "JR Nara Line", "JR Sagano Line", "Kintetsu Kyoto Line", "Kyoto Subway Karasuma"] },
  { id: "tofukuji", name: "Tofukuji", nameJa: "東福寺", cityId: "kyoto-city", lat: 34.9770, lon: 135.7720, lines: ["JR Nara Line", "Keihan Main Line"] },
  { id: "inari", name: "Inari", nameJa: "稲荷", cityId: "kyoto-city", lat: 34.9700, lon: 135.7712, lines: ["JR Nara Line"] },
  { id: "shichijo", name: "Shichijo", nameJa: "七条", cityId: "kyoto-city", lat: 34.9900, lon: 135.7690, lines: ["Keihan Main Line"] },
  { id: "kiyomizu-gojo", name: "Kiyomizu-Gojo", nameJa: "清水五条", cityId: "kyoto-city", lat: 34.9960, lon: 135.7690, lines: ["Keihan Main Line"] },
  { id: "gion-shijo", name: "Gion-Shijo", nameJa: "祇園四条", cityId: "kyoto-city", lat: 35.0037, lon: 135.7720, lines: ["Keihan Main Line"] },
  { id: "saga-arashiyama", name: "Saga-Arashiyama", nameJa: "嵯峨嵐山", cityId: "kyoto-city", lat: 35.0185, lon: 135.6810, lines: ["JR Sagano Line"] },
  { id: "sanjo", name: "Sanjo", nameJa: "三条", cityId: "kyoto-city", lat: 35.0093, lon: 135.7725, lines: ["Keihan Main Line", "Kyoto Subway Tozai"] },
  { id: "demachiyanagi", name: "Demachiyanagi", nameJa: "出町柳", cityId: "kyoto-city", lat: 35.0300, lon: 135.7730, lines: ["Keihan Main Line"] },
  { id: "shijo", name: "Shijo", nameJa: "四条", cityId: "kyoto-city", lat: 35.0037, lon: 135.7590, lines: ["Kyoto Subway Karasuma"] },
  { id: "karasuma-oike", name: "Karasuma-Oike", nameJa: "烏丸御池", cityId: "kyoto-city", lat: 35.0107, lon: 135.7594, lines: ["Kyoto Subway Karasuma", "Kyoto Subway Tozai"] },
  { id: "imadegawa", name: "Imadegawa", nameJa: "今出川", cityId: "kyoto-city", lat: 35.0296, lon: 135.7597, lines: ["Kyoto Subway Karasuma"] },
  { id: "kitaoji", name: "Kitaoji", nameJa: "北大路", cityId: "kyoto-city", lat: 35.0433, lon: 135.7590, lines: ["Kyoto Subway Karasuma", "Kyoto City Bus"] },
  { id: "nijojo-mae", name: "Nijojo-mae", nameJa: "二条城前", cityId: "kyoto-city", lat: 35.0116, lon: 135.7500, lines: ["Kyoto Subway Tozai"] },
  { id: "nijo", name: "Nijo", nameJa: "二条", cityId: "kyoto-city", lat: 35.0107, lon: 135.7415, lines: ["JR Sagano Line", "Kyoto Subway Tozai"] },
  { id: "higashiyama", name: "Higashiyama", nameJa: "東山", cityId: "kyoto-city", lat: 35.0083, lon: 135.7790, lines: ["Kyoto Subway Tozai"] },
  { id: "keage", name: "Keage", nameJa: "蹴上", cityId: "kyoto-city", lat: 35.0075, lon: 135.7880, lines: ["Kyoto Subway Tozai"] },
  { id: "kinkakuji-michi", name: "Kinkakuji-michi (bus)", nameJa: "金閣寺道", cityId: "kyoto-city", lat: 35.0390, lon: 135.7300, lines: ["Kyoto City Bus"] },
  { id: "ryoanji-mae", name: "Ryoanji-mae (bus)", nameJa: "竜安寺前", cityId: "kyoto-city", lat: 35.0345, lon: 135.7185, lines: ["Kyoto City Bus"] },
  { id: "ginkakuji-michi", name: "Ginkakuji-michi (bus)", nameJa: "銀閣寺道", cityId: "kyoto-city", lat: 35.0265, lon: 135.7920, lines: ["Kyoto City Bus"] },
  // Osaka
  { id: "shin-osaka", name: "Shin-Osaka", nameJa: "新大阪", cityId: "osaka-city", lat: 34.7335, lon: 135.5000,
    lines: ["Tokaido Shinkansen", "Sanyo Shinkansen", "JR Kyoto Line", "Osaka Metro Midosuji"] },
  { id: "osaka", name: "Osaka", nameJa: "大阪", cityId: "osaka-city", lat: 34.7025, lon: 135.4959, lines: ["JR Kyoto Line", "JR Osaka Loop Line"] },
  { id: "namba", name: "Namba", nameJa: "難波", cityId: "osaka-city", lat: 34.6659, lon: 135.5012, lines: ["Osaka Metro Midosuji", "Kintetsu Nara Line", "Nankai Main Line"] },
  { id: "tennoji", name: "Tennoji", nameJa: "天王寺", cityId: "osaka-city", lat: 34.6470, lon: 135.5140, lines: ["JR Osaka Loop Line", "JR Kansai Airport Rapid", "Osaka Metro Midosuji"] },
  { id: "kansai-airport", name: "Kansai Airport", nameJa: "関西空港", cityId: "osaka-city", lat: 34.4320, lon: 135.2440, lines: ["JR Kansai Airport Rapid", "JR Haruka", "Nankai Main Line"] },
  { id: "osakajokoen", name: "Osakajokoen", nameJa: "大阪城公園", cityId: "osaka-city", lat: 34.6900, lon: 135.5340, lines: ["JR Osaka Loop Line"] },
  { id: "tanimachi-4chome", name: "Tanimachi 4-chome", nameJa: "谷町四丁目", cityId: "osaka-city", lat: 34.6830, lon: 135.5170, lines: ["Osaka Metro Tanimachi", "Osaka Metro Chuo"] },
  { id: "shinsaibashi", name: "Shinsaibashi", nameJa: "心斎橋", cityId: "osaka-city", lat: 34.6750, lon: 135.5010, lines: ["Osaka Metro Midosuji"] },
  { id: "nippombashi", name: "Nippombashi", nameJa: "日本橋", cityId: "osaka-city", lat: 34.6650, lon: 135.5060, lines: ["Osaka Metro Sennichimae", "Osaka Metro Sakaisuji"] },
  { id: "dobutsuen-mae", name: "Dobutsuen-mae", nameJa: "動物園前", cityId: "osaka-city", lat: 34.6500, lon: 135.5030, lines: ["Osaka Metro Midosuji"] },
  { id: "bentencho", name: "Bentencho", nameJa: "弁天町", cityId: "osaka-city", lat: 34.6690, lon: 135.4620, lines: ["JR Osaka Loop Line", "Osaka Metro Chuo"] },
  { id: "osakako", name: "Osakako", nameJa: "大阪港", cityId: "osaka-city", lat: 34.6560, lon: 135.4330, lines: ["Osaka Metro Chuo"] },
  // Nara
  { id: "nara", name: "Nara (JR)", nameJa: "奈良", cityId: "nara-city", lat: 34.6810, lon: 135.8190, lines: ["JR Nara Line"] },
  { id: "kintetsu-nara", name: "Kintetsu-Nara", nameJa: "近鉄奈良", cityId: "nara-city", lat: 34.6840, lon: 135.8280, lines: ["Kintetsu Nara Line", "Kintetsu Kyoto Line"] },
  { id: "horyuji", name: "Horyuji", nameJa: "法隆寺", cityId: "nara-city", lat: 34.6050, lon: 135.7420, lines: ["JR Yamatoji Line"] },
  // Himeji
  { id: "himeji", name: "Himeji", nameJa: "姫路", cityId: "himeji", lat: 34.8270, lon: 134.6900, lines: ["Sanyo Shinkansen", "JR Kobe Line", "Shinki Bus"] },
  { id: "shosha-ropeway", name: "Shosha Ropeway (bus)", nameJa: "書写山ロープウェイ", cityId: "himeji", lat: 34.8640, lon: 134.6480, lines: ["Shinki Bus"] },
  // Hiroshima & Miyajima
  { id: "hiroshima", name: "Hiroshima", nameJa: "広島", cityId: "hiroshima-city", lat: 34.3978, lon: 132.4750, lines: ["Sanyo Shinkansen", "JR Sanyo Line", "Hiroden"] },
  { id: "genbaku-domu-mae", name: "Genbaku Dome-mae", nameJa: "原爆ドーム前", cityId: "hiroshima-city", lat: 34.3950, lon: 132.4530, lines: ["Hiroden"] },
  { id: "kamiyacho-nishi", name: "Kamiyacho-nishi", nameJa: "紙屋町西", cityId: "hiroshima-city", lat: 34.3940, lon: 132.4570, lines: ["Hiroden"] },
  { id: "hondori", name: "Hondori", nameJa: "本通", cityId: "hiroshima-city", lat: 34.3930, lon: 132.4590, lines: ["Hiroden"] },
  { id: "hatchobori", name: "Hatchobori", nameJa: "八丁堀", cityId: "hiroshima-city", lat: 34.3935, lon: 132.4660, lines: ["Hiroden"] },
  { id: "shukkeien-mae", name: "Shukkeien-mae", nameJa: "縮景園前", cityId: "hiroshima-city", lat: 34.3990, lon: 132.4680, lines: ["Hiroden"] },
  { id: "momijidani", name: "Momijidani", nameJa: "紅葉谷", cityId: "miyajima", lat: 34.2950, lon: 132.3220, lines: [] },
  { id: "miyajimaguchi", name: "Miyajimaguchi", nameJa: "宮島口", cityId: "hiroshima-city", lat: 34.3120, lon: 132.3030, lines: ["JR Sanyo Line", "JR Miyajima Ferry"] },
  { id: "miyajima-pier", name: "Miyajima Pier", nameJa: "宮島桟橋", cityId: "miyajima", lat: 34.3020, lon: 132.3220, lines: ["JR Miyajima Ferry"] },
];

const e = (partial: Omit<Edge, "mode"> & { mode?: Edge["mode"] }): Edge => ({ mode: "rail", stops: 1, ...partial });

export const edges: Edge[] = [
  // ---- Kyoto local
  ...bothWays(e({ from: "kyoto", to: "tofukuji", line: "JR Nara Line · Local", operator: "jr-west", km: 1.1, minutes: 3 })),
  ...bothWays(e({ from: "tofukuji", to: "inari", line: "JR Nara Line · Local", operator: "jr-west", km: 1.6, minutes: 2,
    note: "Local only — the Miyakoji Rapid does not stop at Inari" })),
  ...bothWays(e({ from: "kyoto", to: "tofukuji", line: "JR Nara Line · Miyakoji Rapid", operator: "jr-west", km: 1.1, minutes: 2 })),
  ...bothWays(e({ from: "tofukuji", to: "shichijo", line: "Keihan Main Line", operator: "keihan", km: 1.0, minutes: 2 })),
  ...bothWays(e({ from: "shichijo", to: "kiyomizu-gojo", line: "Keihan Main Line", operator: "keihan", km: 0.7, minutes: 2 })),
  ...bothWays(e({ from: "kiyomizu-gojo", to: "gion-shijo", line: "Keihan Main Line", operator: "keihan", km: 0.9, minutes: 2 })),
  ...bothWays(e({ from: "kyoto", to: "saga-arashiyama", line: "JR Sagano Line · Local", operator: "jr-west", km: 10.3, minutes: 16, stops: 6 })),
  ...bothWays(e({ from: "kyoto", to: "saga-arashiyama", line: "JR Sagano Line · Rapid", operator: "jr-west", km: 10.3, minutes: 12, stops: 3 })),

  // ---- Kyoto local, second pass: subway, Keihan north, buses
  ...bothWays(e({ from: "gion-shijo", to: "sanjo", line: "Keihan Main Line", operator: "keihan", km: 0.7, minutes: 2 })),
  ...bothWays(e({ from: "sanjo", to: "demachiyanagi", line: "Keihan Main Line", operator: "keihan", km: 2.3, minutes: 5, stops: 2 })),
  ...bothWays(e({ from: "kyoto", to: "shijo", line: "Kyoto Subway Karasuma", operator: "kyoto-subway", km: 2.1, minutes: 4, stops: 2 })),
  ...bothWays(e({ from: "shijo", to: "karasuma-oike", line: "Kyoto Subway Karasuma", operator: "kyoto-subway", km: 1.0, minutes: 2 })),
  ...bothWays(e({ from: "karasuma-oike", to: "imadegawa", line: "Kyoto Subway Karasuma", operator: "kyoto-subway", km: 2.0, minutes: 4, stops: 2 })),
  ...bothWays(e({ from: "imadegawa", to: "kitaoji", line: "Kyoto Subway Karasuma", operator: "kyoto-subway", km: 1.9, minutes: 4, stops: 2 })),
  ...bothWays(e({ from: "karasuma-oike", to: "nijojo-mae", line: "Kyoto Subway Tozai", operator: "kyoto-subway", km: 1.0, minutes: 2 })),
  ...bothWays(e({ from: "nijojo-mae", to: "nijo", line: "Kyoto Subway Tozai", operator: "kyoto-subway", km: 0.8, minutes: 2 })),
  ...bothWays(e({ from: "karasuma-oike", to: "sanjo", line: "Kyoto Subway Tozai", operator: "kyoto-subway", km: 1.4, minutes: 3, stops: 2 })),
  ...bothWays(e({ from: "sanjo", to: "higashiyama", line: "Kyoto Subway Tozai", operator: "kyoto-subway", km: 0.7, minutes: 2 })),
  ...bothWays(e({ from: "higashiyama", to: "keage", line: "Kyoto Subway Tozai", operator: "kyoto-subway", km: 0.9, minutes: 2 })),
  ...bothWays(e({ from: "kyoto", to: "nijo", line: "JR Sagano Line · Local", operator: "jr-west", km: 4.2, minutes: 6, stops: 2 })),
  ...bothWays(e({ from: "nijo", to: "saga-arashiyama", line: "JR Sagano Line · Local", operator: "jr-west", km: 6.1, minutes: 10, stops: 4 })),
  ...bothWays(e({ from: "kitaoji", to: "kinkakuji-michi", line: "Kyoto City Bus · 204/205", mode: "bus", operator: "kyoto-bus", km: 2.4, minutes: 10, stops: 5,
    note: "Subway to Kitaoji then this bus beats the 205 from Kyoto Station, which crawls." })),
  ...bothWays(e({ from: "kinkakuji-michi", to: "ryoanji-mae", line: "Kyoto City Bus · 59", mode: "bus", operator: "kyoto-bus", km: 1.5, minutes: 6, stops: 3 })),
  ...bothWays(e({ from: "demachiyanagi", to: "ginkakuji-michi", line: "Kyoto City Bus · 17/203", mode: "bus", operator: "kyoto-bus", km: 1.8, minutes: 8, stops: 4 })),
  ...bothWays(e({ from: "kyoto", to: "kinkakuji-michi", line: "Kyoto City Bus · 205", mode: "bus", operator: "kyoto-bus", km: 7.5, minutes: 40, stops: 20,
    note: "Slow and packed. Only if the subway-and-bus route is somehow worse for you." })),

  // ---- Kyoto ↔ Osaka
  ...bothWays(e({ from: "kyoto", to: "osaka", line: "JR Kyoto Line · Special Rapid", operator: "jr-west", km: 42.8, minutes: 29, stops: 3, fareJpy: 580,
    note: "IC card, no reservation. Every 15 minutes." })),
  ...bothWays(e({ from: "kyoto", to: "shin-osaka", line: "JR Kyoto Line · Special Rapid", operator: "jr-west", km: 39.0, minutes: 24, stops: 2, fareJpy: 580 })),
  ...bothWays(e({ from: "kyoto", to: "shin-osaka", line: "Tokaido Shinkansen · Nozomi", operator: "jr-central", km: 39.0, minutes: 13, stops: 1, fareJpy: 1450,
    note: "Unreserved. Not worth it over the Special Rapid unless you are connecting onward." })),
  ...bothWays(e({ from: "shin-osaka", to: "osaka", line: "JR Kyoto Line", operator: "jr-west", km: 3.8, minutes: 4 })),

  // ---- Osaka local
  ...bothWays(e({ from: "shin-osaka", to: "namba", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 9.1, minutes: 15, stops: 7 })),
  ...bothWays(e({ from: "namba", to: "tennoji", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 3.7, minutes: 7, stops: 3 })),
  ...bothWays(e({ from: "osaka", to: "tennoji", line: "JR Osaka Loop Line", operator: "jr-west", km: 10.7, minutes: 16, stops: 8 })),

  // ---- Osaka local, second pass
  ...bothWays(e({ from: "shin-osaka", to: "osaka", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 3.4, minutes: 6, stops: 2,
    note: "Umeda station for the Metro; Osaka station for JR. Same complex, ten-minute walk between the far ends." })),
  ...bothWays(e({ from: "osaka", to: "shinsaibashi", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 3.0, minutes: 7, stops: 3 })),
  ...bothWays(e({ from: "shinsaibashi", to: "namba", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 0.9, minutes: 2 })),
  ...bothWays(e({ from: "namba", to: "dobutsuen-mae", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 1.9, minutes: 4, stops: 2 })),
  ...bothWays(e({ from: "dobutsuen-mae", to: "tennoji", line: "Osaka Metro Midosuji", operator: "osaka-metro", km: 1.0, minutes: 2 })),
  ...bothWays(e({ from: "namba", to: "nippombashi", line: "Osaka Metro Sennichimae", operator: "osaka-metro", km: 0.7, minutes: 2 })),
  ...bothWays(e({ from: "osaka", to: "osakajokoen", line: "JR Osaka Loop Line", operator: "jr-west", km: 5.3, minutes: 9, stops: 4 })),
  ...bothWays(e({ from: "osaka", to: "tanimachi-4chome", line: "Osaka Metro Tanimachi", operator: "osaka-metro", km: 3.5, minutes: 8, stops: 4 })),
  ...bothWays(e({ from: "tanimachi-4chome", to: "tennoji", line: "Osaka Metro Tanimachi", operator: "osaka-metro", km: 2.6, minutes: 6, stops: 3 })),
  ...bothWays(e({ from: "osaka", to: "bentencho", line: "JR Osaka Loop Line", operator: "jr-west", km: 5.0, minutes: 8, stops: 4 })),
  ...bothWays(e({ from: "bentencho", to: "osakako", line: "Osaka Metro Chuo", operator: "osaka-metro", km: 2.5, minutes: 4, stops: 2 })),

  // ---- Airport
  ...bothWays(e({ from: "kansai-airport", to: "tennoji", line: "JR Kansai Airport Rapid", operator: "jr-west", km: 46.0, minutes: 50, stops: 6, fareJpy: 1080 })),
  ...bothWays(e({ from: "kansai-airport", to: "namba", line: "Nankai Rapi:t", operator: "nankai", km: 42.8, minutes: 38, stops: 3, fareJpy: 1490,
    note: "Reserved seat, buy at the airport." })),
  ...bothWays(e({ from: "kansai-airport", to: "kyoto", line: "JR Haruka", operator: "jr-west", km: 100.0, minutes: 80, stops: 3, fareJpy: 3640,
    note: "Reserved. Direct to Kyoto with luggage space; the cheaper way is Rapid to Tennoji then Special Rapid." })),

  // ---- Nara
  ...bothWays(e({ from: "kyoto", to: "kintetsu-nara", line: "Kintetsu Kyoto Line · Limited Express", operator: "kintetsu", km: 34.6, minutes: 35, stops: 2, fareJpy: 1280,
    note: "Reserved seat included. Kintetsu-Nara is a 5 min walk from the park; JR Nara is 20." })),
  ...bothWays(e({ from: "kyoto", to: "kintetsu-nara", line: "Kintetsu Kyoto Line · Express", operator: "kintetsu", km: 34.6, minutes: 45, stops: 8, fareJpy: 760 })),
  ...bothWays(e({ from: "kyoto", to: "nara", line: "JR Nara Line · Miyakoji Rapid", operator: "jr-west", km: 41.7, minutes: 45, stops: 6, fareJpy: 720 })),
  ...bothWays(e({ from: "namba", to: "kintetsu-nara", line: "Kintetsu Nara Line · Rapid Express", operator: "kintetsu", km: 30.8, minutes: 39, stops: 5, fareJpy: 680 })),
  ...bothWays(e({ from: "nara", to: "kintetsu-nara", line: "walk", mode: "walk", minutes: 15, km: 1.2 })),
  ...bothWays(e({ from: "nara", to: "horyuji", line: "JR Yamatoji Line", operator: "jr-west", km: 9.9, minutes: 12, stops: 3,
    note: "Horyu-ji is a 20 min walk or a short bus from the station." })),

  // ---- Sanyo corridor
  ...bothWays(e({ from: "shin-osaka", to: "himeji", line: "Sanyo Shinkansen · Nozomi", operator: "jr-west", km: 91.7, minutes: 30, stops: 2, fareJpy: 3280 })),
  ...bothWays(e({ from: "himeji", to: "hiroshima", line: "Sanyo Shinkansen · Nozomi", operator: "jr-west", km: 210.3, minutes: 58, stops: 2, fareJpy: 7500 })),
  ...bothWays(e({ from: "shin-osaka", to: "hiroshima", line: "Sanyo Shinkansen · Nozomi", operator: "jr-west", km: 302.0, minutes: 85, stops: 3, fareJpy: 10420 })),
  ...bothWays(e({ from: "kyoto", to: "hiroshima", line: "Tokaido–Sanyo Shinkansen · Nozomi", operator: "jr-west", km: 341.0, minutes: 100, stops: 4, fareJpy: 10890,
    note: "Unreserved. Add ¥530 for a reserved seat — required for a case over 160cm." })),

  // ---- Hiroshima local
  ...bothWays(e({ from: "hiroshima", to: "genbaku-domu-mae", line: "Hiroden · Line 2", operator: "hiroden", km: 2.5, minutes: 15, stops: 7,
    note: "Slow but simple. Pay when you get off." })),
  ...bothWays(e({ from: "hiroshima", to: "kamiyacho-nishi", line: "Hiroden · Line 2", operator: "hiroden", km: 2.2, minutes: 13, stops: 6 })),
  ...bothWays(e({ from: "kamiyacho-nishi", to: "genbaku-domu-mae", line: "Hiroden · Line 2", operator: "hiroden", km: 0.3, minutes: 2 })),
  ...bothWays(e({ from: "kamiyacho-nishi", to: "hondori", line: "walk", mode: "walk", minutes: 3, km: 0.2 })),
  ...bothWays(e({ from: "hiroshima", to: "hatchobori", line: "Hiroden · Line 1", operator: "hiroden", km: 1.6, minutes: 10, stops: 5 })),
  ...bothWays(e({ from: "hatchobori", to: "shukkeien-mae", line: "Hiroden · Line 9", operator: "hiroden", km: 0.6, minutes: 3, stops: 2 })),
  ...bothWays(e({ from: "himeji", to: "shosha-ropeway", line: "Shinki Bus · 8", mode: "bus", operator: "shinki-bus", km: 8.0, minutes: 30, stops: 15 })),
  ...bothWays(e({ from: "miyajima-pier", to: "momijidani", line: "walk", mode: "walk", minutes: 20, km: 1.4 })),
  ...bothWays(e({ from: "hiroshima", to: "miyajimaguchi", line: "JR Sanyo Line", operator: "jr-west", km: 20.0, minutes: 26, stops: 8 })),
  ...bothWays(e({ from: "miyajimaguchi", to: "miyajima-pier", line: "JR Miyajima Ferry", mode: "ferry", operator: null, km: 1.8, minutes: 10, fareJpy: 300,
    note: "Every 15 minutes. Last ferry back is earlier than people expect — check the board." })),
];
