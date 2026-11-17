import { draft, type PlaceSeed } from "./types";

const c = "himeji";

/** Himeji — 8 drafts. An en-route cluster, not a stay (D15). Seed values. */
export const himeji: PlaceSeed[] = [
  draft({ id: "hmj-castle", city: c, name: "Himeji Castle", nameJa: "姫路城", category: "castle", lat: 34.8394, lon: 134.6939,
    station: "himeji", walk: 15, tags: ["history"], energy: 0.5, crowd: 0.8, discovery: 0.05, signature: 0.95, physical: 0.5,
    taste: 60, typical: 120, full: 180, window: ["before 09:30"], opens: "09:00", closes: "17:00", hoursVary: true,
    crowdNote: "Entry to the keep is capped on busy days and the wait inside on the stairs can be long. At opening you climb freely.",
    tip: "The finest surviving castle in Japan, original not rebuilt, and white enough to hurt your eyes. Six floors of steep wooden stairs in socks. Straight up the main road from the station — you can see it from the platform. Lockers at the station for luggage.",
    cost: 2500, pairs: ["hmj-kokoen"], seasons: ["sakura"], sources: ["himejicastle.jp"] }),

  draft({ id: "hmj-kokoen", city: c, name: "Koko-en Garden", nameJa: "好古園", category: "garden", lat: 34.8375, lon: 134.6890,
    station: "himeji", walk: 15, tags: ["nature"], energy: 0.2, crowd: 0.3, discovery: 0.4, signature: 0.5,
    taste: 30, typical: 50, full: 80, opens: "09:00", closes: "17:00",
    crowdNote: "Calm even when the castle is packed.",
    tip: "Nine walled gardens next to the castle on the site of the old samurai residences, built in 1992 and better than that sounds. The combined ticket with the castle saves a little. Tea house on the pond.",
    cost: 310, seasons: ["koyo"], pairs: ["hmj-castle"], sources: ["himeji-machishin.jp/ryokka/kokoen"] }),

  draft({ id: "hmj-engyoji", city: c, name: "Engyo-ji", nameJa: "圓教寺", category: "temple", lat: 34.8650, lon: 134.6470,
    station: "shosha-ropeway", walk: 5, tags: ["shrines", "nature", "history"], energy: 0.5, crowd: 0.2, discovery: 0.7, signature: 0.7, physical: 0.5,
    taste: 60, typical: 120, full: 180, opens: "08:30", closes: "17:00", hoursVary: true,
    crowdNote: "A few pilgrims and walkers. The Last Samurai was filmed here and it is still empty.",
    tip: "A mountaintop temple complex reached by bus and ropeway, then a twenty-minute uphill walk through forest. Wooden halls on stilts, nobody about. Half a day from Himeji station; the castle is the morning, this is the afternoon.",
    cost: 500, skipIf: ["limited_mobility"], seasons: ["koyo"], sources: ["shosha.or.jp"] }),

  draft({ id: "hmj-city-art-museum", city: c, name: "Himeji City Museum of Art", nameJa: "姫路市立美術館", category: "museum", lat: 34.8410, lon: 134.6980,
    station: "himeji", walk: 20, tags: ["art"], energy: 0.1, crowd: 0.2, discovery: 0.5, signature: 0.3,
    taste: 30, typical: 60, full: 90, opens: "10:00", closes: "17:00", closedWeekdays: [1],
    crowdNote: "Quiet.",
    tip: "Closed Mondays. A red-brick former army arsenal beside the castle moat, with a decent Belgian collection. The lawn in front is the best angle on the castle for a photograph.",
    cost: 300, pairs: ["hmj-castle"], sources: ["city.himeji.lg.jp/art"] }),

  draft({ id: "hmj-history-museum", city: c, name: "Hyogo Prefectural Museum of History", nameJa: "兵庫県立歴史博物館", category: "museum", lat: 34.8425, lon: 134.6975,
    station: "himeji", walk: 20, tags: ["history"], energy: 0.1, crowd: 0.2, discovery: 0.5, signature: 0.3,
    taste: 30, typical: 60, full: 90, opens: "10:00", closes: "17:00", closedWeekdays: [1],
    crowdNote: "Quiet.",
    tip: "Closed Mondays. Kenzo Tange's building, with castle models and a room where you can try on armour. Only if you have time after the castle and Koko-en; the reflection of the keep in its glass wall is free.",
    cost: 200, sources: ["hyogo-c.ed.jp/~rekihaku-bo"] }),

  draft({ id: "hmj-otemae-dori", city: c, name: "Otemae-dori", nameJa: "大手前通り", category: "street", lat: 34.8330, lon: 134.6910,
    station: "himeji", walk: 1, tags: ["shopping", "food"], energy: 0.2, crowd: 0.4, discovery: 0.1, signature: 0.3,
    taste: 15, typical: 20, full: 40,
    crowdNote: "A wide boulevard, never crowded.",
    tip: "The straight kilometre from the station to the castle gate, with the keep framed at the end of it the whole way. Walk it rather than take the bus; the covered arcades either side have lunch.",
    cost: 0, pairs: ["hmj-castle"], sources: ["wikivoyage"] }),

  // Position: Wikidata Q11447552. Hours, closing days, price and the bus
  // from the museum's own pages; architect and dates from ja.wikipedia.
  draft({ id: "hmj-literature-museum", city: c, name: "Himeji City Museum of Literature", nameJa: "姫路文学館", category: "museum", lat: 34.8418, lon: 134.6877,
    station: null, walk: null, tags: ["art", "history"], energy: 0.1, crowd: 0.1, discovery: 0.7, signature: 0.2,
    taste: 30, typical: 60, full: 90, opens: "10:00", closes: "17:00", closedWeekdays: [1],
    crowdNote: "Quiet. Most castle visitors never come round to this side.",
    tip: "Two concrete buildings by Tadao Ando on the castle's west side, worth seeing for the architecture alone. The main hall tells the castle's history and Harima's writers; the south building, with the Shiba Ryotaro room and a café, is free. Closed Mondays (open on a public holiday, closed the day after). Shinki Bus from Himeji Station, about 6 minutes to Ichinohashi Bungakukan-mae, then 4 minutes' walk north.",
    cost: 450, pairs: ["hmj-otokoyama"], sources: ["himejibungakukan.jp/riyou/", "himejibungakukan.jp/riyou/access/", "himejibungakukan.jp/gaiyou/sisetu/", "ja.wikipedia.org/wiki/姫路文学館"] }),

  // Position: OpenStreetMap (© OpenStreetMap contributors, ODbL), the park's
  // sign; it has no Wikidata item. Steps, the view and the bus from Himeji's
  // tourism site. No hours are published: a public hillside park.
  draft({ id: "hmj-otokoyama", city: c, name: "Otokoyama Haisuichi Park", nameJa: "男山配水池公園", category: "viewpoint", lat: 34.8409, lon: 134.6897,
    station: null, walk: null, tags: ["shrines", "offbeat"], energy: 0.4, crowd: 0.15, discovery: 0.8, signature: 0.3, physical: 0.6,
    taste: 20, typical: 40, full: 60,
    crowdNote: "A local's viewpoint. A handful of photographers at most.",
    tip: "198 stone steps up a hill north-west of the castle to a small park on top of the city's old reservoir, with the whole keep and its three smaller towers in one view. On the way up is the little Senhime Tenmangu, said to enshrine the god Princess Senhime worshipped. The bus stop is Ichinohashi Bungakukan-mae / Otokoyama Senhime Tenmangu, 5 minutes' walk; the Museum of Literature is at the same stop.",
    cost: 0, skipIf: ["limited_mobility"], pairs: ["hmj-literature-museum"], sources: ["himeji-kanko.jp/feature/50/", "himeji-kanko.jp/spot/120/", "openstreetmap.org/node/2844163558"] }),
];
