import { draft, type PlaceSeed } from "./types";

const c = "yokohama";

/** Yokohama — 12 drafts. Facts from the places' own pages or the city's.
 *  Seed values throughout. */
export const yokohama: PlaceSeed[] = [
  draft({ id: "ykh-chinatown", city: c, name: "Yokohama Chinatown", nameJa: "横浜中華街", category: "district", lat: 35.4427, lon: 139.6459,
    station: "motomachi-chukagai", walk: 1, tags: ["food", "shopping", "shrines"], energy: 0.25, crowd: 0.8, discovery: 0.1, signature: 0.85, physical: 0.2,
    taste: 45, typical: 120, full: 240,
    crowdNote: "Weekends and holidays bring dense crowds and long queues for street food and dim sum; weekdays are noticeably calmer.",
    tip: "The streets and gates are open to all and free; each restaurant and shop keeps its own hours. Between meals, look into the temples, Yokohama Kanteibyo and Yokohama Mazu Miao.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-yamashita", "ykh-motomachi"], sources: ["chinatown.or.jp"] }),

  draft({ id: "ykh-sankeien", city: c, name: "Sankeien Garden", nameJa: "三溪園", category: "garden", lat: 35.4161, lon: 139.6593,
    station: "honmoku", walk: 10, tags: ["nature", "history", "art"], energy: 0.45, crowd: 0.4, discovery: 0.6, signature: 0.7, physical: 0.4,
    taste: 60, typical: 120, full: 180, window: ["before 11:00"], opens: "09:00", closes: "17:00",
    crowdNote: "Cherry-blossom season in late March and the autumn leaves in late November bring crowds; weekday mornings are quiet.",
    tip: "Adults ¥900, children ¥200; last entry is at 16:30. Closed from 26 to 31 December. Walk both the Outer and the Inner Garden, where historic buildings brought from Kyoto and Kamakura stand, among them the three-storey pagoda of the former Tomyo-ji. From Negishi Station take bus 58 or 101 to Honmoku and walk 10 minutes; or take bus 8 or 168 from Yokohama Station's East Exit to Sankeien-iriguchi and walk 5 minutes.",
    cost: 900, closedWeekdays: [], skipIf: ["limited_mobility"], seasons: ["sakura", "koyo"], sources: ["sankeien.or.jp"] }),

  draft({ id: "ykh-red-brick", city: c, name: "Red Brick Warehouse", nameJa: "横浜赤レンガ倉庫", category: "shopping", lat: 35.4513, lon: 139.6425,
    station: "bashamichi", walk: 6, tags: ["history", "shopping", "food"], energy: 0.2, crowd: 0.8, discovery: 0.2, signature: 0.6, physical: 0.2,
    taste: 30, typical: 60, full: 120, window: ["after 17:00"], opens: "11:00", closes: "20:00",
    crowdNote: "Busiest on sunny weekend afternoons and during the festivals in the plaza, such as Oktoberfest and the Christmas Market; weekdays are much calmer.",
    tip: "Two old brick warehouses, free to walk into: Building 2 is shops and food, Building 1 holds cultural exhibitions and keeps shorter hours. Open every day except legal inspection days. Step out on the second-floor balconies for the view over the port. Nihon-odori Station is also about 6 minutes away.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-osanbashi"], sources: ["yokohama-akarenga.jp"] }),

  draft({ id: "ykh-cup-noodles", city: c, name: "Cup Noodles Museum", nameJa: "カップヌードルミュージアム 横浜", category: "museum", lat: 35.4555, lon: 139.6385,
    station: "minatomirai", walk: 8, tags: ["popculture", "food", "art"], energy: 0.3, crowd: 0.8, discovery: 0.3, signature: 0.6, physical: 0.2,
    taste: 45, typical: 90, full: 150, window: ["before 11:00"], opens: "10:00", closes: "18:00",
    crowdNote: "Weekends, holidays and school breaks bring crowds and waits for the workshops; a weekday at opening is the easiest.",
    tip: "Adults ¥500; high-school students and younger free. Last entry is at 17:00. Closed on Tuesdays (on the next day when Tuesday is a holiday), at New Year, and for a few days of maintenance in winter. Making your own cup at the My CUPNOODLES Factory is ¥500 a cup. The Noodles Bazaar on the fourth floor serves noodles from eight countries.",
    cost: 500, closedWeekdays: [2], sources: ["cupnoodles-museum.jp"] }),

  draft({ id: "ykh-yamashita", city: c, name: "Yamashita Park", nameJa: "山下公園", category: "park", lat: 35.4456, lon: 139.6500,
    station: "motomachi-chukagai", walk: 3, tags: ["nature", "history"], energy: 0.2, crowd: 0.6, discovery: 0.1, signature: 0.6, physical: 0.1,
    taste: 30, typical: 60, full: 90, window: ["after 16:00"],
    crowdNote: "The lawns and sea walk fill with families on fine weekend afternoons, but there is room for everyone. Mornings and evenings are quiet.",
    tip: "An open public park along the waterfront, built on rubble from the 1923 Great Kanto Earthquake, with the old liner Hikawa Maru moored alongside. See the rose garden, the Guardian of Water statue and the Indian Water Tower.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-hikawa-maru", "ykh-chinatown"], sources: ["city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/koen/koen/daihyoteki/kouen008.html"] }),

  draft({ id: "ykh-ramen-museum", city: c, name: "Shin-Yokohama Ramen Museum", nameJa: "新横浜ラーメン博物館", category: "museum", lat: 35.5098, lon: 139.6145,
    station: "shin-yokohama", walk: 1, tags: ["food", "history"], energy: 0.2, crowd: 0.8, discovery: 0.2, signature: 0.6, physical: 0.3,
    taste: 45, typical: 90, full: 150, window: ["after 14:00"], opens: "11:00", closes: "21:00",
    crowdNote: "The ramen shops queue at lunch and dinner, worst at weekends. Weekday afternoons between 14:00 and 17:00 mean much shorter waits.",
    tip: "Entry ¥450 for adults; each shop sells its bowls from its own ticket machine, and every shop has a mini bowl, so you can try several regions. Last orders are at 20:30. It opens a little earlier at weekends and on holidays, and closes on 31 December and 1 January. Exit 10 of the subway station is a minute away; JR Shin-Yokohama is about 5 minutes.",
    cost: 450, closedWeekdays: [], sources: ["raumen.co.jp"] }),

  draft({ id: "ykh-osanbashi", city: c, name: "Osanbashi Pier", nameJa: "横浜港大さん橋国際客船ターミナル", category: "viewpoint", lat: 35.4520, lon: 139.6475,
    station: "nihon-odori", walk: 7, tags: ["art", "nightlife"], energy: 0.2, crowd: 0.4, discovery: 0.4, signature: 0.6, physical: 0.2,
    taste: 30, typical: 60, full: 90,
    crowdNote: "The open deck absorbs people easily; it is busiest at sunset and on nights when a big cruise ship is in.",
    tip: "The roof of the passenger terminal, a wooden deck called the Whale's Back, is a free public park open day and night, with an open view of the Minato Mirai skyline and the Bay Bridge. The terminal lobby keeps shorter hours. Bring a layer: the wind off the bay can be sharp.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-red-brick", "ykh-yamashita"], sources: ["osanbashi.jp"] }),

  draft({ id: "ykh-harbor-view", city: c, name: "Harbor View Park", nameJa: "港の見える丘公園", category: "park", lat: 35.4399, lon: 139.6550,
    station: "motomachi-chukagai", walk: 5, tags: ["nature", "nightlife"], energy: 0.3, crowd: 0.4, discovery: 0.5, signature: 0.5, physical: 0.3,
    taste: 30, typical: 60, full: 90,
    crowdNote: "Couples and small tour groups gather at the lookout around dusk and at weekends; early mornings and weekday afternoons are quiet in the rose gardens.",
    tip: "Free and open around the clock, though the France-yama section closes at night. The hilltop terrace looks over the port and the Yokohama Bay Bridge. The Western-style houses in the park, such as the British House Yokohama, keep their own daytime hours. Use Exit 6 of Motomachi-Chukagai Station.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-motomachi"], sources: ["city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/koen/koen/daihyoteki/kouen007.html"] }),

  draft({ id: "ykh-hikawa-maru", city: c, name: "NYK Hikawa Maru", nameJa: "日本郵船氷川丸", category: "museum", lat: 35.4467, lon: 139.6513,
    station: "motomachi-chukagai", walk: 3, tags: ["history"], energy: 0.3, crowd: 0.3, discovery: 0.5, signature: 0.5, physical: 0.5,
    taste: 30, typical: 60, full: 90, opens: "10:00", closes: "17:00",
    crowdNote: "Light on weekdays, with a moderate crowd of families on sunny weekends and holidays.",
    tip: "Adults ¥300, cash only; last entry 16:30. Closed on Mondays (open on a holiday Monday, then closed the next weekday). Walk through the 1930s Art Deco first-class rooms and out along the promenade deck for the view of the port. The stairs between decks are steep and narrow.",
    cost: 300, closedWeekdays: [1], skipIf: ["limited_mobility"], pairs: ["ykh-yamashita"], sources: ["hikawamaru.nyk.com"] }),

  draft({ id: "ykh-motomachi", city: c, name: "Motomachi Shopping Street", nameJa: "横浜元町ショッピングストリート", category: "street", lat: 35.4409, lon: 139.6495,
    station: "motomachi-chukagai", walk: 1, tags: ["shopping", "history"], energy: 0.25, crowd: 0.5, discovery: 0.4, signature: 0.5, physical: 0.2,
    taste: 30, typical: 60, full: 120,
    crowdNote: "Relaxed on weekday mornings and busy on weekend afternoons, busiest during its big seasonal sales.",
    tip: "A public shopping street, free to walk at any hour, about 600 m long; each shop and café keeps its own hours and days off. Known as the home of the 1970s 'Hama-Tra' fashion its boutiques started.",
    cost: 0, closedWeekdays: [], pairs: ["ykh-chinatown", "ykh-harbor-view"], sources: ["motomachi.or.jp"] }),

  draft({ id: "ykh-hara-railway", city: c, name: "Hara Model Railway Museum", nameJa: "原鉄道模型博物館", category: "museum", lat: 35.4631, lon: 139.6249,
    station: "shin-takashima", walk: 3, tags: ["history", "offbeat"], energy: 0.3, crowd: 0.4, discovery: 0.7, signature: 0.5, physical: 0.2,
    taste: 45, typical: 75, full: 120, opens: "10:00", closes: "17:00",
    crowdNote: "Families and railway fans fill the weekend and holiday slots, which can sell out; weekday afternoons are calm.",
    tip: "Entry is by dated ticket bought in advance from e+ or a FamilyMart multi-copy machine: adults ¥1,500, junior-high and high-school students ¥1,000, children 4 and over ¥750. Ticket sales end at 16:00 and last entry is 16:30. Closed on Tuesdays and Wednesdays (open on a holiday, then closed the next open day), at New Year, and for a few days of maintenance in winter. The centrepiece is Ichiban Tetsumo Park, one of the world's largest indoor Gauge 1 layouts. Also 5 minutes from Yokohama Station's East Exit.",
    cost: 1500, booking: "required", lead: 0, closedWeekdays: [2, 3], sources: ["hara-mrm.com"] }),

  draft({ id: "ykh-marine-tower", city: c, name: "Yokohama Marine Tower", nameJa: "横浜マリンタワー", category: "viewpoint", lat: 35.4440, lon: 139.6508,
    station: "motomachi-chukagai", walk: 1, tags: ["art", "nightlife"], energy: 0.2, crowd: 0.5, discovery: 0.3, signature: 0.5, physical: 0.1,
    taste: 30, typical: 60, full: 90, opens: "10:00", closes: "22:00",
    crowdNote: "Most people come around sunset and in the early evening for the night view; weekday daytimes are quiet.",
    tip: "By day adults pay ¥1,000 on weekdays and ¥1,200 at weekends and on holidays; night tickets are ¥1,200 and ¥1,400. Buying online on the tower's own site saves about ¥100. Last entry to the 29th- and 30th-floor decks is 21:30. In the evening the 30th floor adds digital art across the view of the harbour. It closes now and then for maintenance.",
    cost: 1000, closedWeekdays: [], pairs: ["ykh-yamashita", "ykh-chinatown"], sources: ["marinetower.yokohama"] }),
];
