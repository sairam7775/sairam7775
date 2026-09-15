import { draft, type PlaceSeed } from "./types";

const c = "himeji";

/** Himeji — 6 drafts. An en-route cluster, not a stay (D15). Seed values. */
export const himeji: PlaceSeed[] = [
  draft({ id: "hmj-castle", city: c, name: "Himeji Castle", nameJa: "姫路城", category: "castle", lat: 34.8394, lon: 134.6939,
    station: "himeji", walk: 15, tags: ["history"], energy: 0.5, crowd: 0.8, discovery: 0.05, signature: 0.95, physical: 0.5,
    taste: 60, typical: 120, full: 180, window: ["before 09:30"], opens: "09:00", closes: "17:00",
    crowdNote: "Entry to the keep is capped on busy days and the wait inside on the stairs can be long. At opening you climb freely.",
    tip: "The finest surviving castle in Japan, original not rebuilt, and white enough to hurt your eyes. Six floors of steep wooden stairs in socks. Straight up the main road from the station — you can see it from the platform. Lockers at the station for luggage.",
    cost: 1000, pairs: ["hmj-kokoen"], seasons: ["sakura"], sources: ["himejicastle.jp"] }),

  draft({ id: "hmj-kokoen", city: c, name: "Koko-en Garden", nameJa: "好古園", category: "garden", lat: 34.8375, lon: 134.6890,
    station: "himeji", walk: 15, tags: ["nature"], energy: 0.2, crowd: 0.3, discovery: 0.4, signature: 0.5,
    taste: 30, typical: 50, full: 80, opens: "09:00", closes: "17:00",
    crowdNote: "Calm even when the castle is packed.",
    tip: "Nine walled gardens next to the castle on the site of the old samurai residences, built in 1992 and better than that sounds. The combined ticket with the castle saves a little. Tea house on the pond.",
    cost: 310, seasons: ["koyo"], pairs: ["hmj-castle"], sources: ["himeji-machishin.jp/ryokka/kokoen"] }),

  draft({ id: "hmj-engyoji", city: c, name: "Engyo-ji", nameJa: "圓教寺", category: "temple", lat: 34.8650, lon: 134.6470,
    station: "shosha-ropeway", walk: 5, tags: ["shrines", "nature", "history"], energy: 0.5, crowd: 0.2, discovery: 0.7, signature: 0.7, physical: 0.5,
    taste: 60, typical: 120, full: 180, opens: "08:30", closes: "17:00",
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
];
