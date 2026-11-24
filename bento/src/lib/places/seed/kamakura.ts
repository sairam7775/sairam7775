import { draft, type PlaceSeed } from "./types";

const c = "kamakura";

/** Kamakura (with Enoshima, filed under Kamakura like its stations) — 13
 *  drafts. Facts from the places' own pages or the Kamakura City Tourist
 *  Association where a place has none. Seed values throughout. */
export const kamakura: PlaceSeed[] = [
  draft({ id: "kmk-kotoku-in", city: c, name: "Kotoku-in (the Great Buddha)", nameJa: "高徳院 (鎌倉大仏)", category: "temple", lat: 35.3167, lon: 139.5357,
    station: "hase", walk: 7, tags: ["shrines", "history"], energy: 0.2, crowd: 0.8, discovery: 0.1, signature: 0.95, physical: 0.1,
    taste: 20, typical: 35, full: 50, window: ["before 09:00", "after 15:30"], opens: "08:00", closes: "17:00", hoursVary: true,
    crowdNote: "School groups and tour buses fill it from mid-morning to mid-afternoon, roughly 10:30 to 15:00. Right at the 08:00 opening it is calm.",
    tip: "Entry to the grounds is ¥300; going inside the statue costs ¥50 more and ends at 16:30. Last entry to the grounds is 15 minutes before closing. Look for the giant straw sandals woven by children from Fukushima on the wall behind the Buddha. Eating and drinking are not allowed in the grounds.",
    cost: 300, closedWeekdays: [], pairs: ["kmk-hasedera", "kmk-kuzuharaoka"], sources: ["kotoku-in.jp"] }),

  draft({ id: "kmk-hasedera", city: c, name: "Hase-dera", nameJa: "長谷寺", category: "temple", lat: 35.3125, lon: 139.5331,
    station: "hase", walk: 5, tags: ["shrines", "history", "nature"], energy: 0.4, crowd: 0.85, discovery: 0.2, signature: 0.75, physical: 0.4,
    taste: 40, typical: 60, full: 90, window: ["before 09:30"], opens: "08:00", closes: "17:00", hoursVary: true,
    crowdNote: "Busy through the middle of the day, and packed in June for the hydrangeas and from late November into early December for the autumn leaves. At the 08:00 opening it is quiet.",
    tip: "Adults ¥400; the Kannon Museum inside charges separately. Last entry is 30 minutes before closing. Climb the terraced paths to the lookout over Yuigahama Beach, and duck into the low Benten Cave.",
    cost: 400, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["koyo"], pairs: ["kmk-kotoku-in"], sources: ["hasedera.jp"] }),

  draft({ id: "kmk-tsurugaoka", city: c, name: "Tsurugaoka Hachimangu", nameJa: "鶴岡八幡宮", category: "shrine", lat: 35.3260, lon: 139.5564,
    station: "kamakura", walk: 10, tags: ["shrines", "history", "nature"], energy: 0.3, crowd: 0.8, discovery: 0.1, signature: 0.85, physical: 0.3,
    taste: 30, typical: 60, full: 90, window: ["before 08:30", "after 17:00"], opens: "06:00", closes: "20:00",
    crowdNote: "Fullest from late morning to mid-afternoon, especially at weekends and on holidays. Before 08:30 the wide grounds are calm.",
    tip: "The grounds are free; the Treasure Hall charges ¥200. Opening at 06:00 makes it a good first stop before the town gets busy. Walk past the Genpei Ponds and up the great stone stairway for the view back down Wakamiya-oji.",
    cost: 0, closedWeekdays: [], seasons: ["sakura", "koyo"], pairs: ["kmk-komachi"], sources: ["trip-kamakura.com/place/japanheritage/209.html"] }),

  draft({ id: "kmk-hokokuji", city: c, name: "Hokoku-ji (the bamboo temple)", nameJa: "報国寺", category: "temple", lat: 35.319973, lon: 139.569293,
    station: "jomyoji", walk: 3, tags: ["shrines", "nature", "history"], energy: 0.2, crowd: 0.7, discovery: 0.3, signature: 0.7, physical: 0.3,
    taste: 25, typical: 45, full: 75, window: ["before 10:00"], opens: "09:00", closes: "16:00",
    crowdNote: "Busiest from 11:00 to 14:00 at weekends and in the autumn, with long waits for tea. At the 09:00 opening it is peaceful.",
    tip: "The temple grounds are free; the bamboo garden costs ¥400. Matcha with dried sweets at the Kyuko-an tea room in the grove is ¥600, served until 15:30. The temple closes from 29 December to 3 January, and may close in severe weather. A Keikyu bus from stand 4 at Kamakura Station's East Exit takes about 12 minutes to the Jomyoji stop.",
    cost: 400, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["sakura", "koyo"], sources: ["houkokuji.or.jp"] }),

  draft({ id: "kmk-komachi", city: c, name: "Komachi-dori", nameJa: "小町通り", category: "street", lat: 35.319633, lon: 139.551386,
    station: "kamakura", walk: 1, tags: ["shopping", "food"], energy: 0.2, crowd: 0.9, discovery: 0.1, signature: 0.6, physical: 0.1,
    taste: 30, typical: 60, full: 120, window: ["before 11:30"],
    crowdNote: "Packed on weekend afternoons; weekday mornings before noon are much easier.",
    tip: "Over 300 shops and food stalls on the way from the station to Tsurugaoka Hachimangu, each keeping its own hours; many take their day off between Tuesday and Thursday. Kamakura's street for snacks and craft souvenirs. Finish what you are eating before you walk into a shop.",
    cost: 0, closedWeekdays: [], pairs: ["kmk-tsurugaoka"], sources: ["kamakura-komachi.com"] }),

  draft({ id: "kmk-meigetsuin", city: c, name: "Meigetsu-in", nameJa: "明月院", category: "temple", lat: 35.3347, lon: 139.5528,
    station: "kita-kamakura", walk: 10, tags: ["shrines", "nature", "history"], energy: 0.3, crowd: 0.9, discovery: 0.3, signature: 0.7, physical: 0.4,
    taste: 30, typical: 60, full: 90, window: ["before 09:30"], opens: "09:00", closes: "16:00", hoursVary: true,
    crowdNote: "Overwhelmed in June, the hydrangea season, with queues outside the gate. Weekday mornings the rest of the year are much quieter.",
    tip: "Adults ¥500. The round Window of Enlightenment looks into the inner garden, which opens only in the iris and autumn-leaf seasons, for ¥500 more. In those seasons the queue builds soon after opening.",
    cost: 500, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["koyo"], pairs: ["kmk-kenchoji"], sources: ["kanagawa-kankou.or.jp/spot/1190", "trip-kamakura.com/place/230.html"] }),

  draft({ id: "kmk-kenchoji", city: c, name: "Kencho-ji", nameJa: "建長寺", category: "temple", lat: 35.3315, lon: 139.5548,
    station: "kita-kamakura", walk: 15, tags: ["shrines", "history", "nature"], energy: 0.45, crowd: 0.5, discovery: 0.2, signature: 0.7, physical: 0.5,
    taste: 45, typical: 90, full: 120, window: ["before 10:00"], opens: "08:30", closes: "16:30",
    crowdNote: "The grounds are big enough to spread people out; it is busiest on cherry-blossom and autumn-leaf weekends.",
    tip: "Adults ¥500, cash only. See the great Sanmon gate, the dragon painted on the ceiling of the Hatto hall and the Zen garden behind the main hall. The climb up the hillside to Hansobo and its lookouts is steep, with views over Kamakura and, on clear days, Mount Fuji.",
    cost: 500, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["sakura", "koyo"], pairs: ["kmk-engakuji", "kmk-meigetsuin"], sources: ["kenchoji.com"] }),

  draft({ id: "kmk-engakuji", city: c, name: "Engaku-ji", nameJa: "円覚寺", category: "temple", lat: 35.3370, lon: 139.5476,
    station: "kita-kamakura", walk: 1, tags: ["shrines", "history", "nature"], energy: 0.4, crowd: 0.6, discovery: 0.2, signature: 0.7, physical: 0.5,
    taste: 45, typical: 80, full: 120, window: ["before 10:00"], opens: "08:30", closes: "16:30", hoursVary: true,
    crowdNote: "Busiest at the gate in late November and early December for the autumn colour; weekday mornings are calm.",
    tip: "Adults ¥500. Last entry is 30 minutes before closing, and it may close in typhoons or snow. Climb the hillside steps to the great bell, a National Treasure, and rest at the tea house up there. Tripods and monopods are not allowed.",
    cost: 500, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["sakura", "koyo"], pairs: ["kmk-kenchoji"], sources: ["engakuji.or.jp"] }),

  draft({ id: "kmk-zeniarai", city: c, name: "Zeniarai Benzaiten", nameJa: "銭洗弁財天宇賀福神社", category: "shrine", lat: 35.3258, lon: 139.5422,
    station: "kamakura", walk: 20, tags: ["shrines", "history", "offbeat"], energy: 0.4, crowd: 0.7, discovery: 0.4, signature: 0.6, physical: 0.5,
    taste: 25, typical: 45, full: 75, window: ["before 09:30"], opens: "08:00", closes: "16:30",
    crowdNote: "Weekends, holidays and the shrine's Snake Days bring queues into the cave; weekday mornings at opening are peaceful.",
    tip: "Entry is free; an offering is up to you. Take a basket from the shrine office, carry your coins or notes into the cave and ladle the spring water over them. The tourist association advises arriving by 16:00. The road up is steep.",
    cost: 0, closedWeekdays: [], skipIf: ["limited_mobility"], pairs: ["kmk-kuzuharaoka"], sources: ["trip-kamakura.com/place/195.html"] }),

  // Reverse direction: the signboard on the course gives about 1h10 from the
  // Daibutsu-zaka entrance to JR Kita-Kamakura (BE-PAL, bepal.net/play/trekking/13088),
  // read 23 Nov 2026. A hike ends an hour before sunset (engine/daylight.ts).
  draft({ id: "kmk-kuzuharaoka", city: c, name: "Kuzuharaoka-Daibutsu Hiking Course", nameJa: "葛原岡・大仏ハイキングコース", category: "hike", lat: 35.3263, lon: 139.5445,
    station: "kita-kamakura", walk: 15, tags: ["nature", "shrines", "history"], energy: 0.6, crowd: 0.4, discovery: 0.6, signature: 0.6, physical: 0.6,
    taste: 60, typical: 90, full: 150, window: ["before 10:00"],
    crowdNote: "Steady walkers on clear spring and autumn weekends; quiet on weekday mornings.",
    tip: "About 3 km of dirt trail, roughly an hour and a half, from beside Jochi-ji near Kita-Kamakura Station over Kuzuharaoka Shrine and Genjiyama Park down to the Great Buddha. Wear shoes with grip: roots and clay turn slippery after rain, and hornets are about from summer into autumn. Side paths lead to Zeniarai Benzaiten and Sasuke Inari Shrine. It can be walked the other way too: from the Daibutsu-zaka entrance near the Great Buddha up over Genjiyama Park to Kita-Kamakura Station, about an hour and ten minutes by the signpost. Walk it in daylight.",
    cost: 0, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["sakura", "koyo"], pairs: ["kmk-kotoku-in", "kmk-zeniarai"], sources: ["trip-kamakura.com/article/95.html", "bepal.net/play/trekking/13088"] }),

  draft({ id: "kmk-enoshima", city: c, name: "Enoshima Island", nameJa: "江の島", category: "island", lat: 35.3005, lon: 139.4808,
    station: "enoshima", walk: 23, tags: ["shrines", "nature", "food", "history"], energy: 0.7, crowd: 0.8, discovery: 0.2, signature: 0.85, physical: 0.7,
    taste: 90, typical: 180, full: 300, window: ["before 10:00"],
    crowdNote: "Benzaiten Nakamise-dori, the main street up from the bridge, and the shrine grounds are packed on sunny weekends and holidays; early weekday mornings are calm.",
    tip: "Enoshima Shrine's grounds are free. The paid parts are the Enoshima Escar escalators (¥500), the Sea Candle tower (¥800), the Iwaya caves (¥500) and the shrine's Hoanden treasure hall (¥200); the one-day eno=pass (¥1,100) covers all four. Past the summit, the way down to Chigogafuchi and the caves is hundreds of steep stone steps, and the same back up. Katase-Enoshima Station on the Odakyu line is about 10 minutes' walk away.",
    cost: 0, closedWeekdays: [], skipIf: ["limited_mobility"], pairs: ["kmk-sea-candle", "kmk-enosui"], sources: ["fujisawa-kanko.jp", "enoshimajinja.or.jp", "enoshimajinja.or.jp/access/", "fujisawa-kanko.jp/access/ticket.html"] }),

  draft({ id: "kmk-sea-candle", city: c, name: "Enoshima Sea Candle", nameJa: "江の島シーキャンドル", category: "viewpoint", lat: 35.299751, lon: 139.478595,
    station: "enoshima", walk: 25, tags: ["nature"], energy: 0.6, crowd: 0.8, discovery: 0.2, signature: 0.6, physical: 0.6,
    taste: 45, typical: 90, full: 150, window: ["after 16:00"], opens: "09:00", closes: "20:00", hoursVary: true,
    crowdNote: "Busiest around sunset and during the winter evening illuminations, when the lift queues; weekday mornings are quiet.",
    tip: "The lighthouse tower stands in the Samuel Cocking Garden at the top of Enoshima. The garden is free by day and charges ¥500 after 17:00 on event evenings; the tower is ¥800 for adults, with last entry at 19:30. The Enoshima Escar escalators (¥500) save the climb. On a clear day the view takes in Sagami Bay, the Izu Peninsula and Mount Fuji.",
    cost: 800, closedWeekdays: [], pairs: ["kmk-enoshima"], sources: ["enoshima-seacandle.com"] }),

  draft({ id: "kmk-enosui", city: c, name: "Enoshima Aquarium", nameJa: "新江ノ島水族館", category: "aquarium", lat: 35.3097, lon: 139.4799,
    station: "enoshima", walk: 10, tags: ["nature"], energy: 0.25, crowd: 0.8, discovery: 0.2, signature: 0.5, physical: 0.2,
    taste: 60, typical: 120, full: 180, window: ["before 10:30", "after 15:00"], opens: "10:00", closes: "17:00", hoursVary: true,
    crowdNote: "Families and school groups fill it on sunny weekends and in the summer holidays; weekday mornings outside school holidays are far calmer.",
    tip: "Adults ¥2,800; high-school students ¥1,800 with ID, elementary and junior-high students ¥1,300. Last entry is an hour before closing. The big Sagami Bay tank and the outdoor dolphin stadium are the highlights. It closes for a few days of maintenance in winter. Katase-Enoshima Station on the Odakyu line is 3 minutes away on foot; Enoshima Station on the Enoden is about 10.",
    cost: 2800, closedWeekdays: [], pairs: ["kmk-enoshima"], sources: ["enosui.com", "enosui.com/access.php"] }),
];
