/** When a season tag counts as "in season": typical best-viewing windows,
 *  by city, with an area override where one city spans very different
 *  heights (Okunikko colours weeks before Nikko's shrines).
 *
 *  Every window is a typical (average-year) range from one named spot's
 *  page, read November 2026, never a forecast: peak moves by a week or more
 *  from year to year, which is why the shown reason says "usually". Japanese
 *  ten-day periods are read as 上旬 1–10, 中旬 11–20, 下旬 21 to month end.
 *  No margin is added either side: no source gives one. A city or season
 *  missing here makes no claim and gets no boost. */

export type SeasonKey = "sakura" | "koyo";

/** [month, day], inclusive at both ends. No window crosses New Year. */
type MonthDay = readonly [number, number];
interface Window { from: MonthDay; to: MonthDay }
type CityWindows = Partial<Record<SeasonKey, Window>>;

const w = (from: MonthDay, to: MonthDay): Window => ({ from, to });

/** City id → season → typical window. Sources are Weathernews spot pages,
 *  "例年の見頃" (typical best viewing), weathernews.jp/<season>/spot/<id>/,
 *  unless a row names another. */
export const CITY_WINDOWS: Record<string, CityWindows> = {
  "kyoto-city": {
    sakura: w([3, 21], [4, 10]), // Maruyama Park, sakura/spot/305: 3月下旬〜4月上旬
    koyo: w([11, 11], [12, 10]), // Tofukuji, koyo/spot/26111: 11月中旬〜12月上旬
  },
  "osaka-city": {
    sakura: w([3, 21], [4, 20]), // Osaka Castle Park, sakura/spot/316: 3月下旬〜4月中旬
    koyo: w([11, 11], [12, 10]), // Osaka Castle Park, koyo/spot/26207: 11月中旬〜12月上旬
  },
  "nara-city": {
    // tenki.jp (Japan Weather Association), Nara Park Somei-Yoshino,
    // tenki.jp/sakura/6/32/56421.html: 例年の見ごろ 3月下旬～4月上旬. (Weathernews
    // sakura/spot/338 says 4月上旬, but for the later Naranokokonoe-zakura.)
    sakura: w([3, 21], [4, 10]),
    koyo: w([11, 11], [12, 10]), // Nara Park, koyo/spot/26402: 11月中旬〜12月上旬
  },
  himeji: {
    sakura: w([3, 21], [4, 10]), // Himeji Castle, sakura/spot/330: 3月下旬〜4月上旬
    koyo: w([11, 11], [11, 30]), // Koko-en, koyo/spot/26302: 11月中旬〜11月下旬
  },
  "hiroshima-city": {
    sakura: w([4, 1], [4, 10]), // Peace Memorial Park, sakura/spot/369: 4月上旬
    koyo: w([11, 21], [11, 30]), // Shukkeien, koyo/spot/26719: 11月下旬
  },
  miyajima: {
    koyo: w([11, 11], [11, 30]), // Miyajima, koyo/spot/26712: 11月中旬〜11月下旬
  },
  "tokyo-city": {
    sakura: w([3, 21], [4, 10]), // Chidorigafuchi, sakura/spot/4410: 3月下旬〜4月上旬 (Ueno, spot/106, says 3月下旬 alone)
    koyo: w([11, 21], [12, 20]), // Rikugien, koyo/spot/24406: 11月下旬〜12月中旬
  },
  yokohama: {
    sakura: w([3, 21], [4, 10]), // Sankeien, sakura/spot/144: 3月下旬〜4月上旬
    koyo: w([11, 21], [12, 20]), // Sankeien, koyo/spot/24604: 11月下旬〜12月中旬
  },
  kamakura: {
    sakura: w([3, 21], [4, 10]), // Tsurugaoka Hachimangu, sakura/spot/142: 3月下旬〜4月上旬
    koyo: w([11, 21], [12, 20]), // Tsurugaoka Hachimangu koyo/spot/24606 and Hasedera koyo/spot/24630: 11月下旬〜12月中旬
  },
  hakone: {
    koyo: w([11, 21], [11, 30]), // Gora Park, koyo/spot/24631: 11月下旬
  },
  nikko: {
    koyo: w([11, 1], [11, 20]), // the shrines and temples, koyo/spot/24107: 11月上旬〜11月中旬
  },
};

/** Places whose window differs from their city's. */
const OKUNIKKO: CityWindows = {
  koyo: w([10, 11], [11, 10]), // Lake Chuzenji, koyo/spot/24104: 10月中旬〜11月上旬
};
export const PLACE_WINDOWS: Record<string, CityWindows> = {
  "nko-kegon": OKUNIKKO,
  "nko-lake-chuzenji": OKUNIKKO,
  "nko-ryuzu": OKUNIKKO,
};

const ord = ([m, d]: MonthDay) => m * 100 + d;

/** The seasons typically at their best at this place on this date
 *  ("YYYY-MM-DD"). Empty outside every window. */
export function seasonsOn(date: string, place: { id: string; cityId: string }): SeasonKey[] {
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const today = m * 100 + d;
  const windows = PLACE_WINDOWS[place.id] ?? CITY_WINDOWS[place.cityId] ?? {};
  return (Object.entries(windows) as [SeasonKey, Window][])
    .filter(([, win]) => ord(win.from) <= today && today <= ord(win.to))
    .map(([key]) => key);
}
