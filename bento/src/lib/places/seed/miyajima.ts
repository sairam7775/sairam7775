import { draft, type PlaceSeed } from "./types";

const c = "miyajima";

/** Miyajima — 8 drafts. Ships with Hiroshima (D15). Seed values throughout. */
export const miyajima: PlaceSeed[] = [
  draft({ id: "miy-itsukushima", city: c, name: "Itsukushima Shrine", nameJa: "厳島神社", category: "shrine", lat: 34.2960, lon: 132.3198,
    station: "miyajima-pier", walk: 12, tags: ["shrines", "nature"], energy: 0.2, crowd: 0.85, discovery: 0.05, signature: 0.95,
    taste: 30, typical: 60, full: 90, window: ["before 09:00", "after 16:30"], opens: "06:30", closes: "18:00",
    crowdNote: "A one-way boardwalk that moves at the pace of the slowest group. First thing and last thing it is yours.",
    tip: "Built over the water, so the tide decides what you see: at high tide the shrine floats, at low tide you can walk out to the torii. Check the tide table before you choose the day. The 6:30 opening is the one to make.",
    cost: 300, pairs: ["miy-great-torii", "miy-daishoin"], seasons: ["koyo"], sources: ["itsukushimajinja.jp"] }),

  draft({ id: "miy-great-torii", city: c, name: "The Great Torii", nameJa: "大鳥居", category: "viewpoint", lat: 34.2985, lon: 132.3185,
    station: "miyajima-pier", walk: 12, tags: ["shrines", "nature"], energy: 0.1, crowd: 0.8, discovery: 0.05, signature: 0.9,
    taste: 15, typical: 30, full: 60,
    crowdNote: "Everyone on the island is looking at it, all day. The beach is wide enough.",
    tip: "Free, and visible from the ferry before you land. Low tide lets you walk out and touch it; high tide at sunset is the photograph. The two happen about six hours apart — you can have both in one day.",
    cost: 0, pairs: ["miy-itsukushima"], sources: ["wikivoyage"] }),

  draft({ id: "miy-daishoin", city: c, name: "Daisho-in", nameJa: "大聖院", category: "temple", lat: 34.2935, lon: 132.3170,
    station: "miyajima-pier", walk: 20, tags: ["shrines", "nature"], energy: 0.35, crowd: 0.25, discovery: 0.6, signature: 0.6, physical: 0.4,
    taste: 30, typical: 60, full: 90, opens: "08:00", closes: "17:00",
    crowdNote: "A fraction of the shrine's crowd. The 500 small statues in knitted hats line the steps.",
    tip: "Up the hill behind the shrine, free, and the most rewarding hour on the island after the shrine itself. Spin the sutra wheels on the stairs. The Misen trail starts from here if you are walking up.",
    cost: 0, seasons: ["koyo"], pairs: ["miy-itsukushima"], sources: ["galilei.ne.jp/daisyoin"] }),

  draft({ id: "miy-senjokaku", city: c, name: "Senjokaku & the pagoda", nameJa: "千畳閣", category: "temple", lat: 34.2985, lon: 132.3215,
    station: "miyajima-pier", walk: 12, tags: ["history", "nature"], energy: 0.15, crowd: 0.3, discovery: 0.5, signature: 0.5,
    taste: 15, typical: 30, full: 45, opens: "08:30", closes: "16:30",
    crowdNote: "Quiet — people photograph the pagoda from below and rarely climb the steps.",
    tip: "A vast, unfinished wooden hall from 1587 — Hideyoshi died before it was done — open on all sides, with the best breeze on the island and a view down onto the shrine roofs. A hundred yen.",
    cost: 100, pairs: ["miy-itsukushima"], sources: ["wikivoyage"] }),

  draft({ id: "miy-omotesando", city: c, name: "Omotesando shopping street", nameJa: "表参道商店街", category: "street", lat: 34.3005, lon: 132.3210,
    station: "miyajima-pier", walk: 5, tags: ["food", "shopping"], energy: 0.15, crowd: 0.8, discovery: 0.1, signature: 0.5,
    taste: 20, typical: 40, full: 75, opens: "10:00", closes: "17:00",
    crowdNote: "Full from late morning until the last day-trippers leave. Early evening it empties out entirely.",
    tip: "Grilled oysters, momiji manju (maple-leaf cakes), and the world's largest rice scoop. The stalls shut around five; if you are staying the night, the island after six is a different place.",
    cost: 0, sources: ["wikivoyage"] }),

  draft({ id: "miy-momijidani", city: c, name: "Momijidani Park", nameJa: "紅葉谷公園", category: "park", lat: 34.2945, lon: 132.3220,
    station: "momijidani", walk: 2, tags: ["nature"], energy: 0.25, crowd: 0.4, discovery: 0.4, signature: 0.6,
    taste: 20, typical: 40, full: 75,
    crowdNote: "Busy in the last two weeks of November for the maples it is named for; otherwise a quiet valley with deer.",
    tip: "The maple valley at the foot of Mount Misen, where the ropeway starts. Come in late November or come for the walk to the ropeway; either way it is fifteen minutes from the shrine.",
    cost: 0, seasons: ["koyo"], pairs: ["miy-misen"], sources: ["wikivoyage"] }),

  draft({ id: "miy-misen", city: c, name: "Mount Misen", nameJa: "弥山", category: "viewpoint", lat: 34.2790, lon: 132.3180,
    station: "momijidani", walk: 5, tags: ["nature", "shrines"], energy: 0.6, crowd: 0.5, discovery: 0.3, signature: 0.8, physical: 0.6,
    taste: 90, typical: 150, full: 240, opens: "09:00", closes: "16:30",
    crowdNote: "The ropeway queues on autumn weekends — an hour is possible. Weekday mornings you walk on.",
    tip: "Two ropeways to the top station, then a real 30-minute walk up to the summit — steps, not a stroll. The view over the Inland Sea is the best in the region. The flame in the hall near the top has burned for 1,200 years. Last ropeway down is early; check it.",
    cost: 2000, skipIf: ["limited_mobility"], seasons: ["koyo"], pairs: ["miy-momijidani"], sources: ["miyajima-ropeway.info"] }),

  draft({ id: "miy-aquarium", city: c, name: "Miyajima Aquarium", nameJa: "宮島水族館", category: "aquarium", lat: 34.2920, lon: 132.3150,
    station: "miyajima-pier", walk: 25, tags: ["nature"], energy: 0.15, crowd: 0.4, discovery: 0.4, signature: 0.3,
    taste: 45, typical: 75, full: 100, opens: "09:00", closes: "17:00",
    crowdNote: "Families; comfortable.",
    tip: "Small and local — Inland Sea fish, oyster farming, a finless porpoise. Good with children or on a wet afternoon; otherwise the island has better uses for the time.",
    cost: 1420, sources: ["miyajima-aqua.jp"] }),
];
