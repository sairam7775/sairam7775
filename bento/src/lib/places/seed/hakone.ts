import { draft, type PlaceSeed } from "./types";

const c = "hakone";

/** Hakone — 10 drafts along the classic loop: Yumoto, the mountain train,
 *  Gora, Owakudani, Lake Ashi and its shore. Facts from the places' own
 *  pages, the Hakone Navi operator site (hakonenavi.jp) or the Kanagawa
 *  Tourism Association where a place has none; read November 2026.
 *  Positions from Wikidata, except the cedar avenue and Hakone Yuryo
 *  (OpenStreetMap, © OpenStreetMap contributors, ODbL) and the Yumoto onsen
 *  town (Hakone town's Wikidata position, by the station). Seed values
 *  throughout. */
export const hakone: PlaceSeed[] = [
  draft({ id: "hkn-open-air-museum", city: c, name: "Hakone Open-Air Museum", nameJa: "箱根 彫刻の森美術館", category: "museum", lat: 35.2447, lon: 139.0515,
    station: "chokoku-no-mori", walk: 2, tags: ["art", "nature"], energy: 0.4, crowd: 0.6, discovery: 0.2, signature: 0.8, physical: 0.3,
    taste: 45, typical: 120, full: 180, window: ["before 11:00"],
    crowdNote: "Tour groups arrive late morning; at the 09:00 opening the lawns are quiet, and the indoor galleries are the first to fill on a rainy day.",
    tip: "Adults ¥2,000 at the counter, ¥1,800 bought online. Last entry is 30 minutes before closing. Open every day of the year. The sculptures are spread over a hillside park, so leave time to walk it rather than hurry between galleries.",
    opens: "09:00", closes: "17:00", cost: 2000, closedWeekdays: [], pairs: ["hkn-gora-park"], sources: ["hakone-oam.or.jp/info/", "hakone-oam.or.jp/aboutus/access"] }),

  draft({ id: "hkn-owakudani", city: c, name: "Owakudani", nameJa: "大涌谷", category: "nature", lat: 35.2419, lon: 139.0207,
    station: "owakudani", walk: 3, tags: ["nature"], energy: 0.3, crowd: 0.8, discovery: 0.1, signature: 0.9, physical: 0.2,
    taste: 20, typical: 45, full: 90, window: ["before 11:00"], opens: "09:00", closes: "16:15", hoursVary: true,
    crowdNote: "The ropeway station and the viewing area are busiest from late morning to mid-afternoon, especially at weekends. The first cabins of the day are the quietest.",
    tip: "The volcanic valley is reached by the Hakone Ropeway, which runs until 16:15 in December and January and longer the rest of the year, and stops in bad weather and for maintenance, so check before going up. Looking around is free. A guided walk on the nature trail runs four times a day (from 10:00, 11:30, 13:00 and 14:30), with an ¥800 safety contribution: it must be booked ahead on hakone.or.jp, is guided in Japanese only and is paid cashless only.",
    cost: 0, closedWeekdays: [], pairs: ["hkn-lake-ashi-cruise"], sources: ["hakonenavi.jp/hakone-ropeway/", "hakonenavi.jp/spot/24859", "hakone.or.jp/od-booking/"] }),

  // No timetable could be read for the ships' first and last sailings, so
  // the hours are left open: the verifier must add them.
  draft({ id: "hkn-lake-ashi-cruise", city: c, name: "Lake Ashi sightseeing cruise", nameJa: "箱根海賊船 (芦ノ湖)", category: "nature", lat: 35.2117, lon: 139.0039,
    station: "togendai", walk: 1, tags: ["nature"], energy: 0.1, crowd: 0.7, discovery: 0.1, signature: 0.8, physical: 0.1,
    taste: 25, typical: 40, full: 60,
    crowdNote: "The ships meeting the ropeway at Togendai fill up from late morning on weekends and holidays; the decks are freer earlier.",
    tip: "The ships sail a loop from Togendai to Hakone-machi and Moto-Hakone, 25 to 40 minutes from Togendai. One way from Togendai to either port is ¥1,700, Hakone-machi to Moto-Hakone ¥600; the special cabin costs ¥800 more from Togendai. Sailings stop in bad weather. Check the timetable for the first and last ships.",
    cost: 1700, closedWeekdays: [], pairs: ["hkn-owakudani", "hkn-hakone-shrine"], sources: ["hakonenavi.jp/hakone-kankosen/"] }),

  draft({ id: "hkn-hakone-shrine", city: c, name: "Hakone Shrine", nameJa: "箱根神社", category: "shrine", lat: 35.2039, lon: 139.0256,
    station: "moto-hakone-ko", walk: 10, tags: ["shrines", "history", "nature"], energy: 0.3, crowd: 0.8, discovery: 0.1, signature: 0.8, physical: 0.3,
    taste: 25, typical: 45, full: 75, window: ["before 10:00"],
    crowdNote: "Weekend and holiday afternoons bring a long queue for photos at the torii on the lakeshore; early morning is calm.",
    tip: "The grounds are free. The Treasure Hall takes visitors from 09:00 to 16:00; the amulet office is open 08:15–17:00. It is a 10-minute walk from Moto-Hakone port. The way up to the main hall is a flight of stone steps through tall cedars.",
    cost: 0, closedWeekdays: [], skipIf: ["limited_mobility"], pairs: ["hkn-cedar-avenue", "hkn-checkpoint"], sources: ["hakonejinja.or.jp", "hakonejinja.or.jp/access"] }),

  draft({ id: "hkn-pola-museum", city: c, name: "Pola Museum of Art", nameJa: "ポーラ美術館", category: "museum", lat: 35.2567, lon: 139.0211,
    station: null, walk: null, tags: ["art", "nature"], energy: 0.3, crowd: 0.4, discovery: 0.4, signature: 0.5, physical: 0.2,
    taste: 60, typical: 90, full: 150,
    crowdNote: "Rarely crowded except on weekend afternoons when a major exhibition is on.",
    tip: "Adults ¥2,200. Last entry 16:30. Open every day, but it can close for up to a few weeks between exhibitions: check the calendar. A free shuttle from behind Gora Station (the hotel and inn bus area, car park 4) takes 8 minutes and runs about every 30 minutes, 13 times a day; seats are limited. A taxi from Gora costs about ¥1,800.",
    opens: "09:00", closes: "17:00", cost: 2200, closedWeekdays: [], sources: ["polamuseum.or.jp", "polamuseum.or.jp/info/", "polamuseum.or.jp/info/access/"] }),

  draft({ id: "hkn-yumoto", city: c, name: "Hakone-Yumoto onsen town", nameJa: "箱根湯本", category: "street", lat: 35.2324, lon: 139.1069,
    station: "hakone-yumoto", walk: 1, tags: ["onsen", "food", "shopping"], energy: 0.2, crowd: 0.7, discovery: 0.1, signature: 0.5, physical: 0.1,
    taste: 20, typical: 45, full: 90,
    crowdNote: "Busiest when the Romancecars arrive and leave, late morning and late afternoon; the street is quieter in between.",
    tip: "The onsen town starts at Hakone-Yumoto Station, where the Romancecar, the mountain train and the Tozan bus all meet, so it fits at the start or the end of the loop. A shuttle bus for the onsen inns (¥200 a ride) leaves from the rotary in front of the station.",
    cost: 0, closedWeekdays: [], pairs: ["hkn-hakone-yuryo"], sources: ["hakonenavi.jp/international/en/station/yumoto"] }),

  // The walk is ESTIMATED from the two positions (about 490 m from the
  // port): no source gives it. The verifier should check it.
  draft({ id: "hkn-cedar-avenue", city: c, name: "Old Tokaido cedar avenue", nameJa: "箱根旧街道杉並木", category: "hike", lat: 35.1967, lon: 139.0290,
    station: "moto-hakone-ko", walk: 6, tags: ["nature", "history"], energy: 0.3, crowd: 0.3, discovery: 0.4, signature: 0.5, physical: 0.3,
    taste: 10, typical: 25, full: 45,
    crowdNote: "Rarely busy: most visitors stay at the shrine and the port.",
    tip: "Free. About 500 m of the old Tokaido highway from Moto-Hakone towards Onshi-Hakone Park, lined with around 400 cedars, the oldest about 350 years old and up to 30–40 m tall. It makes a shaded walk between Hakone Shrine and the Hakone Checkpoint.",
    cost: 0, closedWeekdays: [], pairs: ["hkn-hakone-shrine", "hkn-checkpoint"], sources: ["kanagawa-kankou.or.jp/spot/71", "tabi-mag.jp/kn0185/"] }),

  draft({ id: "hkn-checkpoint", city: c, name: "Hakone Checkpoint", nameJa: "箱根関所", category: "museum", lat: 35.1924, lon: 139.0261,
    station: "hakone-machi-ko", walk: 5, tags: ["history"], energy: 0.3, crowd: 0.5, discovery: 0.3, signature: 0.5, physical: 0.2,
    taste: 20, typical: 40, full: 60, opens: "09:00", closes: "16:30", hoursVary: true,
    crowdNote: "School groups visit on weekday mornings in term time; otherwise it is seldom crowded.",
    tip: "Adults ¥500, or ¥400 with a Hakone Freepass. Open half an hour longer from March to November; last entry 30 minutes before closing. A 5-minute walk from Hakone-machi port, 2 minutes from the Hakone Sekisho-ato bus stop. The rebuilt guardhouses show how travellers on the Tokaido were checked.",
    cost: 500, closedWeekdays: [], pairs: ["hkn-cedar-avenue", "hkn-hakone-shrine"], sources: ["hakonesekisyo.jp"] }),

  draft({ id: "hkn-gora-park", city: c, name: "Gora Park", nameJa: "箱根強羅公園", category: "garden", lat: 35.2486, lon: 139.0451,
    station: "gora", walk: 5, tags: ["nature"], energy: 0.3, crowd: 0.4, discovery: 0.3, signature: 0.4, physical: 0.4,
    taste: 25, typical: 45, full: 90, opens: "09:30", closes: "16:30", hoursVary: true,
    crowdNote: "Busiest at weekends in the azalea and autumn seasons; on weekdays it is calm.",
    tip: "Adults ¥650; free with a Hakone Freepass. Open longer from March to November; last entry 30 minutes before closing. Closed for maintenance on 1 January, the third Monday of January and the second Monday of May. The main gate is nearest Koen-shimo on the cable car; the park climbs a slope.",
    cost: 650, closedWeekdays: [], seasons: ["koyo"], pairs: ["hkn-open-air-museum"], sources: ["hakonenavi.jp/gorapark/intro/", "kanagawa-kankou.or.jp/spot/1388"] }),

  draft({ id: "hkn-hakone-yuryo", city: c, name: "Hakone Yuryo (day onsen)", nameJa: "箱根湯寮", category: "onsen", lat: 35.2338, lon: 139.0958,
    station: null, walk: null, tags: ["onsen"], energy: 0.1, crowd: 0.5, discovery: 0.3, signature: 0.5, physical: 0.1,
    taste: 60, typical: 90, full: 150, window: ["after 15:00"], opens: "10:00", closes: "20:00",
    crowdNote: "Weekend afternoons are the busiest; weekday mornings are quiet.",
    tip: "A free shuttle bus from Hakone-Yumoto Station takes 3 minutes. The large baths take the last guests at 19:00 on weekdays; open until 21:00 on Saturdays, Sundays and holidays. Adults ¥1,700–1,800 on weekdays, ¥2,000–2,200 at weekends and holidays. Private open-air baths are booked by the room for 120 minutes, from ¥10,400. Tattoos are allowed. It closes for a few days of maintenance now and then.",
    cost: 1700, closedWeekdays: [], pairs: ["hkn-yumoto"], sources: ["hakoneyuryo.jp", "hakoneyuryo.jp/price/"] }),
];
