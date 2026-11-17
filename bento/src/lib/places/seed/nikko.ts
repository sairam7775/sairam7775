import { draft, type PlaceSeed } from "./types";

const c = "nikko";

/** Nikko — 10 drafts: the shrines and temples of the World Heritage area,
 *  the gorge and villa west of it, and Okunikko up the bus line (Kegon
 *  Falls, Lake Chuzenji, Ryuzu Falls). Facts from the places' own pages;
 *  where one could not be read (Futarasan's site refused the connection),
 *  from Tochigi's tourism site (tochinavi.net) or japan-guide.com. Read
 *  November 2026. Positions from Wikidata, except the Lake Chuzenji shore
 *  at Chuzenji Onsen (OpenStreetMap, © OpenStreetMap contributors, ODbL).
 *  Seed values throughout. */
export const nikko: PlaceSeed[] = [
  draft({ id: "nko-toshogu", city: c, name: "Nikko Toshogu", nameJa: "日光東照宮", category: "shrine", lat: 36.7592, lon: 139.5986,
    station: "shinkyo", walk: 10, tags: ["shrines", "history", "art"], energy: 0.5, crowd: 0.9, discovery: 0.05, signature: 0.95, physical: 0.5,
    taste: 60, typical: 90, full: 150, window: ["before 10:00"], opens: "09:00", closes: "16:00", hoursVary: true,
    crowdNote: "Tour buses and school groups fill it from mid-morning, with queues at the Yomeimon gate and the sleeping cat. The first hour after opening is the calmest.",
    tip: "Adults ¥1,600; the Treasure House is ¥1,000 more, or ¥2,400 for both. Open an hour longer from April to October; tickets stop 30 minutes before closing. Ceremonies and repair work sometimes close parts of the shrine. An audio guide costs ¥500 a day. The climb to Ieyasu's tomb at the Okusha is a long flight of stone steps.",
    cost: 1600, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["koyo"], pairs: ["nko-rinnoji", "nko-futarasan", "nko-taiyuin"], sources: ["toshogu.jp/pages/25/", "japan-guide.com/e/e3805.html"] }),

  draft({ id: "nko-rinnoji", city: c, name: "Rinnoji (Sanbutsudo Hall)", nameJa: "日光山輪王寺 三仏堂", category: "temple", lat: 36.7542, lon: 139.6027,
    station: "shinkyo", walk: 5, tags: ["shrines", "history"], energy: 0.3, crowd: 0.6, discovery: 0.2, signature: 0.7, physical: 0.3,
    taste: 20, typical: 40, full: 75, opens: "08:00", closes: "16:00", hoursVary: true,
    crowdNote: "Busy when the Toshogu tour groups pass through mid-morning; it opens an hour before Toshogu, so early is easy.",
    tip: "The Sanbutsudo Hall is ¥400; a ticket with Taiyuin is ¥900, sold until 14:30 from April to October and 13:30 from November to March. The Treasure House and Shoyoen garden are ¥300. Open an hour longer from April to October; tickets stop 30 minutes before closing. The hall closes on a few festival days (3 February, 2 April, and from 11:00 on 1 April).",
    cost: 400, closedWeekdays: [], pairs: ["nko-toshogu", "nko-shinkyo", "nko-taiyuin"], sources: ["rinnoji.or.jp/information.html", "japan-guide.com/e/e3803.html"] }),

  draft({ id: "nko-futarasan", city: c, name: "Futarasan Shrine", nameJa: "日光二荒山神社", category: "shrine", lat: 36.7589, lon: 139.5964,
    station: "shinkyo", walk: 10, tags: ["shrines", "history", "nature"], energy: 0.3, crowd: 0.5, discovery: 0.3, signature: 0.6, physical: 0.3,
    taste: 15, typical: 30, full: 60, opens: "09:00", closes: "16:00", hoursVary: true,
    crowdNote: "Quieter than Toshogu next door; groups pass through but rarely stay long.",
    tip: "Most of the grounds are free; the small paid garden area (the shin-en) is ¥300. Open longer from April to October; last entry 30 minutes before closing. It is about 200 m west of Toshogu, on the way to Taiyuin.",
    cost: 0, closedWeekdays: [], pairs: ["nko-toshogu", "nko-taiyuin"], sources: ["japan-guide.com/e/e3804.html"] }),

  draft({ id: "nko-shinkyo", city: c, name: "Shinkyo Bridge", nameJa: "神橋", category: "viewpoint", lat: 36.7534, lon: 139.6040,
    station: "shinkyo", walk: 1, tags: ["shrines", "history"], energy: 0.1, crowd: 0.6, discovery: 0.1, signature: 0.6, physical: 0.1,
    taste: 5, typical: 15, full: 25, opens: "09:30", closes: "15:30", hoursVary: true,
    crowdNote: "Photo stops crowd the roadside from mid-morning; crossing the bridge itself is rarely busy.",
    tip: "Crossing the vermilion bridge costs ¥300; it is open every day, an hour longer from April to October. It stands right by the Shinkyo bus stop, at the entrance to the shrine and temple area.",
    cost: 300, closedWeekdays: [], pairs: ["nko-rinnoji"], sources: ["tochinavi.net/spot/home/index.shtml?id=14356"] }),

  draft({ id: "nko-kanmangafuchi", city: c, name: "Kanmangafuchi Abyss", nameJa: "憾満ヶ淵", category: "nature", lat: 36.7500, lon: 139.5918,
    station: "tamozawa", walk: 15, tags: ["nature", "offbeat"], energy: 0.4, crowd: 0.3, discovery: 0.6, signature: 0.4, physical: 0.4,
    taste: 20, typical: 40, full: 60,
    crowdNote: "Rarely busy; a few groups at weekends in the autumn.",
    tip: "Free. A riverside path through the gorge lined with about 70 stone Jizo statues. It is a 10–15 minute walk from the Tamozawa bus stop through a residential area, or about 30 minutes on foot from Toshogu.",
    cost: 0, closedWeekdays: [], seasons: ["koyo"], pairs: ["nko-tamozawa"], sources: ["japan-guide.com/e/e3810.html"] }),

  draft({ id: "nko-taiyuin", city: c, name: "Taiyuin (Iemitsu's mausoleum)", nameJa: "輪王寺大猷院", category: "temple", lat: 36.7577, lon: 139.5941,
    station: "shinkyo", walk: 10, tags: ["shrines", "history", "art"], energy: 0.4, crowd: 0.4, discovery: 0.4, signature: 0.6, physical: 0.4,
    taste: 25, typical: 45, full: 75, opens: "08:00", closes: "16:00", hoursVary: true,
    crowdNote: "Much calmer than Toshogu; most groups skip it.",
    tip: "Adults ¥550, or ¥900 with Rinnoji's Sanbutsudo Hall. Open an hour longer from April to October; tickets stop 30 minutes before closing. The worship hall's interior closes on a few festival days (18–20 April, 17 May, 14–15 July). Expect several flights of steps between the gates.",
    cost: 550, closedWeekdays: [], skipIf: ["limited_mobility"], pairs: ["nko-futarasan", "nko-toshogu", "nko-rinnoji"], sources: ["rinnoji.or.jp/information.html", "japan-guide.com/e/e3802.html"] }),

  draft({ id: "nko-kegon", city: c, name: "Kegon Falls", nameJa: "華厳滝", category: "nature", lat: 36.7379, lon: 139.5020,
    station: "chuzenji-onsen", walk: 5, tags: ["nature"], energy: 0.2, crowd: 0.8, discovery: 0.1, signature: 0.85, physical: 0.1,
    taste: 15, typical: 30, full: 45, opens: "09:00", closes: "16:30", hoursVary: true,
    crowdNote: "Packed in mid-October to early November for the autumn leaves, when the road up from Nikko jams; on other weekdays it is easy.",
    tip: "The lift down to the lower viewing deck is ¥600 return: it drops 100 m in a minute. Open longer from March to November. A 5-minute walk from the Chuzenji Onsen bus stop, about 50 minutes by bus from Nikko. In the autumn-leaf season, buses up the Irohazaka road can be badly delayed, especially at weekends.",
    cost: 600, closedWeekdays: [], seasons: ["koyo"], pairs: ["nko-lake-chuzenji"], sources: ["kegon.jp/info/", "kegon.jp/access/", "japan-guide.com/e/e3812.html"] }),

  // The walk is ESTIMATED: the bus stop is modelled at Kegon Falls, about
  // 230 m from this shore position; no source gives it.
  draft({ id: "nko-lake-chuzenji", city: c, name: "Lake Chuzenji", nameJa: "中禅寺湖", category: "nature", lat: 36.7387, lon: 139.4997,
    station: "chuzenji-onsen", walk: 3, tags: ["nature"], energy: 0.2, crowd: 0.4, discovery: 0.2, signature: 0.6, physical: 0.2,
    taste: 20, typical: 60, full: 120,
    crowdNote: "The shore at Chuzenji Onsen is busy on autumn weekends; walk a little along it and it empties.",
    tip: "Free to walk along. Sightseeing boats sail from the second week of April through November: a full loop of the lake takes about an hour for ¥1,850, calling near Ryuzu Falls, the former embassy villas and Chuzenji Temple.",
    cost: 0, closedWeekdays: [], seasons: ["koyo"], pairs: ["nko-kegon", "nko-ryuzu"], sources: ["japan-guide.com/e/e3806.html"] }),

  // The walk is ESTIMATED: the stop is modelled at the falls' own position
  // and japan-guide.com says only to get off there.
  draft({ id: "nko-ryuzu", city: c, name: "Ryuzu Falls", nameJa: "竜頭の滝", category: "nature", lat: 36.7588, lon: 139.4513,
    station: "ryuzu-no-taki", walk: 1, tags: ["nature"], energy: 0.2, crowd: 0.6, discovery: 0.4, signature: 0.5, physical: 0.2,
    taste: 10, typical: 25, full: 45,
    crowdNote: "The small viewing deck fills on autumn weekends; at other times it is quiet.",
    tip: "Free, seen from a small viewing deck at the foot of the falls. Get off at the Ryuzu no taki bus stop: only buses for Yumoto Onsen go there, about an hour from Nikko.",
    cost: 0, closedWeekdays: [], seasons: ["koyo"], pairs: ["nko-lake-chuzenji"], sources: ["japan-guide.com/e/e3813.html"] }),

  draft({ id: "nko-tamozawa", city: c, name: "Nikko Tamozawa Imperial Villa", nameJa: "日光田母沢御用邸記念公園", category: "garden", lat: 36.7525, lon: 139.5914,
    station: "tamozawa", walk: 1, tags: ["history", "nature"], energy: 0.3, crowd: 0.3, discovery: 0.5, signature: 0.5, physical: 0.3,
    taste: 30, typical: 60, full: 90, opens: "09:00", closes: "16:30", hoursVary: true,
    crowdNote: "Seldom crowded, even on autumn weekends.",
    tip: "Adults ¥600. Last entry is 45 minutes before closing (an hour from April to October, when it stays open longer). Closed on Tuesdays (the next day when Tuesday is a holiday) and from 29 December to 1 January; it stays open on some Tuesdays in spring.",
    cost: 600, closedWeekdays: [2], seasons: ["koyo"], pairs: ["nko-kanmangafuchi"], sources: ["park-tochigi.com/tamozawa/"] }),
];
