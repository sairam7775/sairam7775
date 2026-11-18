/** Nikko, hand-seeded: the two ways in from Tokyo and the bus up to Lake
 *  Chuzenji.
 *
 *  The Tobu limited express from Asakusa, and the Tohoku Shinkansen from
 *  Tokyo and Ueno to Utsunomiya with the JR Nikko Line on from there,
 *  joined to the Tokyo seed at Asakusa, Tokyo and Ueno. In Nikko, the walk
 *  between the JR and Tobu stations and the Tobu bus for Chuzenji Onsen and
 *  Yumoto Onsen, with the four stops the drafted places need.
 *
 *  Sources (read November 2026):
 *  - Operating km: ja.wikipedia 東北新幹線 (Ueno 3.6, Utsunomiya 109.5 from
 *    Tokyo), 日光線 (40.5 km, five stations between), 東武日光線 (Tobu-Dobutsu-
 *    Koen – Tobu-Nikko 94.5 km) with Asakusa – Tobu-Dobutsu-Koen 41.0 km
 *    from 東武伊勢崎線. The bus has no published km.
 *  - Positions: Wikidata (CC0). The bus stops have no open position, so
 *    each sits at the Wikidata position of the place it serves, marked
 *    approximate at each stop.
 *  - Minutes: see each line; where published figures differ the larger is
 *    used, as in kanagawa.ts.
 *  - Fares: the Shinkansen to Utsunomiya is past the end of JR East's band
 *    table (100 km), so it is unpriced; the JR Nikko Line is a local line
 *    and carries its own exact fare. Tobu's limited express charge
 *    depends on the train and the day (japan-guide.com gives ¥2,850–3,540
 *    in all from Asakusa), and Tobu Bus publishes no fare table that could
 *    be read. Those rides count as unpriced, never free. For the
 *    record: japan-guide.com gives the bus as ¥350 to the shrines or
 *    Tamozawa, ¥1,250 to Chuzenji Onsen and ¥1,600 to Ryuzu Falls.
 *
 *  Every number here is a SEED VALUE: check minutes and fares against the
 *  operators' timetables before launch, and after each March timetable
 *  change. No ODPT data, no Google Maps data. */
import { bothWays } from "../graph";
import type { Edge, Station } from "../types";

export const stations: Station[] = [
  // ---- Outside Bento's cities: where the Shinkansen meets the Nikko Line.
  { id: "utsunomiya", name: "Utsunomiya", nameJa: "宇都宮", cityId: null, lat: 36.5586, lon: 139.8983, lines: ["Tohoku Shinkansen · Yamabiko","JR Nikko Line"] },
  // ---- Nikko
  { id: "jr-nikko", name: "Nikko (JR)", nameJa: "日光", cityId: "nikko", lat: 36.7472, lon: 139.6222, lines: ["JR Nikko Line"] },
  { id: "tobu-nikko", name: "Tobu-Nikko", nameJa: "東武日光", cityId: "nikko", lat: 36.7479, lon: 139.6195, lines: ["Tobu Limited Express · Kegon","Tobu Bus · Chuzenji Onsen and Yumoto Onsen"] },
  // For Shinkyo, Rinnoji, Toshogu, Futarasan and Taiyuin: the shrines are a
  // 5–10 minute walk (japan-guide.com, Nikko access). Approximate: this is
  // Shinkyo bridge's own position (Wikidata Q28040588), at the stop.
  { id: "shinkyo", name: "Shinkyo (bus)", nameJa: "神橋", cityId: "nikko", lat: 36.7534, lon: 139.6040, lines: ["Tobu Bus · Chuzenji Onsen and Yumoto Onsen"] },
  // For the Tamozawa villa (1 minute) and Kanmangafuchi (10–15 minutes).
  // Approximate: the villa's position (Wikidata Q11504890).
  { id: "tamozawa", name: "Tamozawa (bus)", nameJa: "日光田母沢御用邸記念公園", cityId: "nikko", lat: 36.7525, lon: 139.5914, lines: ["Tobu Bus · Chuzenji Onsen and Yumoto Onsen"] },
  // For Kegon Falls (5 minutes, kegon.jp) and Lake Chuzenji. Approximate:
  // Kegon Falls' position (Wikidata Q37580).
  { id: "chuzenji-onsen", name: "Chuzenji Onsen (bus)", nameJa: "中禅寺温泉", cityId: "nikko", lat: 36.7379, lon: 139.5020, lines: ["Tobu Bus · Chuzenji Onsen and Yumoto Onsen"] },
  // Approximate: Ryuzu Falls' position (Wikidata Q37814).
  { id: "ryuzu-no-taki", name: "Ryuzu no taki (bus)", nameJa: "竜頭の滝", cityId: "nikko", lat: 36.7588, lon: 139.4513, lines: ["Tobu Bus · Chuzenji Onsen and Yumoto Onsen"] },
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

const TOBU = "Tobu Limited Express · Kegon";
const YAMABIKO = "Tohoku Shinkansen · Yamabiko";
const NIKKO_LINE = "JR Nikko Line";
const BUS = "Tobu Bus · Chuzenji Onsen and Yumoto Onsen";

export const edges: Edge[] = [
  // ---- Tobu limited express, Asakusa – Tobu-Nikko. Minutes: about two
  // hours (Visit Nikko, the city's visitor site; japan-guide.com); Toshogu's
  // access page and Ekitan's Kegon guide say about 1 hour 50, so the larger
  // is used. Stops on every train: Tokyo Skytree, Kita-Senju, Kasukabe,
  // Shimo-Imaichi (Ekitan). Unpriced: see the header.
  ...bothWays(e({ from: "asakusa", to: "tobu-nikko", line: TOBU, operator: "tobu", km: 135.5, minutes: 120, stops: 5,
    note: "All seats are reserved: buy a limited express ticket as well as the fare; its price depends on the train. Some trains need a change at Shimo-Imaichi." })),

  // ---- Tohoku Shinkansen to Utsunomiya. Minutes from JR East's timetable
  // for the 09:40 Yamabiko from Tokyo, November 2026: Ueno 09:45–09:46,
  // Omiya 10:04, Utsunomiya 10:28. Omiya (and Ueno, from Tokyo) counted in
  // stops. No Tokyo – Ueno hop: nobody rides the Shinkansen one stop, and a
  // 5-minute hop there would pull Tokyo-area routes onto it. Over 100 km,
  // so unpriced even with JR East's band table.
  ...bothWays(e({ from: "tokyo", to: "utsunomiya", line: YAMABIKO, operator: "jr-east", km: 109.5, minutes: 47, stops: 3 })),
  ...bothWays(e({ from: "ueno", to: "utsunomiya", line: YAMABIKO, operator: "jr-east", km: 105.9, minutes: 42, stops: 2 })),

  // ---- JR Nikko Line, Utsunomiya – Nikko, every train all stations (five
  // between). About 45 minutes (Toshogu's access page); JR East's timetable
  // shows 42 and 43 for the 08:46 and 12:15 locals, November 2026.
  // Fare: exact ¥803 IC (¥810 by ticket), Utsunomiya – Nikko, from Ekitan
  // and NAVITIME route searches (reviewer's fact-check, November 2026). The
  // Nikko Line is a local line (地方交通線), priced from JR East's dearer
  // local-line table, not the trunk-line bands in fares.ts; the band for
  // 40.5 km happens to give the same ¥803. A station added on this line
  // later must carry its own exact fare, never take the band table.
  ...bothWays(e({ from: "utsunomiya", to: "jr-nikko", line: NIKKO_LINE, operator: "jr-east", km: 40.5, minutes: 45, stops: 6, fareJpy: 803 })),

  // ---- JR Nikko – Tobu-Nikko on foot: a few minutes apart (about 5 by
  // JR East's travel magazine and other guides; about 260 m between the
  // Wikidata positions), plus the 3 minutes of waiting every walk carries.
  ...bothWays(e({ from: "jr-nikko", to: "tobu-nikko", line: "walk", mode: "walk", minutes: 8 })),

  // ---- Tobu Bus for Chuzenji Onsen and Yumoto Onsen. Buses start at JR
  // Nikko and call at Tobu-Nikko (japan-guide.com). Minutes from
  // japan-guide.com: the shrines and Tamozawa about 10, Chuzenji Onsen
  // about 50, Ryuzu no taki about an hour. Shinkyo is 7 of those 10 (5 to 7
  // in visitor guides; the larger), and the rest is split to match.
  ...outAndBack(e({ from: "tobu-nikko", to: "shinkyo", line: BUS, mode: "bus", operator: "tobu-bus", minutes: 7,
    note: "Buses start at JR Nikko Station and call at Tobu-Nikko: take one for Chuzenji Onsen or Yumoto Onsen." })),
  ...bothWays(e({ from: "shinkyo", to: "tamozawa", line: BUS, mode: "bus", operator: "tobu-bus", minutes: 3 })),
  ...bothWays(e({ from: "tamozawa", to: "chuzenji-onsen", line: BUS, mode: "bus", operator: "tobu-bus", minutes: 40 })),
  ...outAndBack(e({ from: "chuzenji-onsen", to: "ryuzu-no-taki", line: BUS, mode: "bus", operator: "tobu-bus", minutes: 10,
    note: "Only buses for Yumoto Onsen go on past Chuzenji Onsen." })),
];
