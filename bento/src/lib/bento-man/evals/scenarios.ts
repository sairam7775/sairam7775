/** The eval set (§17 O1): planning scenarios with known-correct answers,
 *  run through the real model against the in-memory store.
 *
 *  Each scenario is a trip in a known state plus one thing the traveller
 *  says, and what a correct turn must do: which tools it calls (the
 *  reasoning has to go through the engine), which it must not, what the
 *  prose must and must not contain, and whether it produced a proposal.
 *  The voice lint runs on every scenario.
 *
 *  These are the regression check for prompt edits and for the Sonnet 5
 *  test (D8). They are deliberately checkable without a judge model. */
import type { MemorySetup } from "../store.memory";

export interface Scenario {
  id: string;
  /** What this scenario guards. */
  intent: string;
  setup: MemorySetup;
  user: string;
  expect: {
    tools?: string[];
    notTools?: string[];
    mustMatch?: RegExp[];
    mustNotMatch?: RegExp[];
    proposal?: "route" | "days" | "none";
    /** Skip the voice lint (never used yet; here so the option is explicit). */
    skipVoice?: boolean;
  };
}

const owner: MemorySetup["prefs"] = {
  pace: "standard",
  interestTags: ["shrines", "history", "nature"],
  energy: 0.25,
  crowdTolerance: 0.15,
  discovery: 0.5,
  excludes: ["beaches", "hiking"],
  mobility: [],
  dietary: [],
  displayCurrency: "GBP",
};
const nov = { title: "Kansai, autumn", startDate: "2026-11-20", endDate: "2026-11-29", partySize: 2 };
const routed: MemorySetup = {
  trip: nov,
  prefs: owner,
  cities: [
    { cityId: "osaka-city", nights: 2, reason: "Airport and food." },
    { cityId: "kyoto-city", nights: 5, reason: "The point of the trip." },
    { cityId: "hiroshima-city", nights: 2, reason: "Peace Park and Miyajima." },
  ],
};

const noExclaim = /^[^!]*$/;

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------- onboarding
  {
    id: "onboard-cold",
    intent: "A first message with nothing set asks, briefly, and does not plan.",
    setup: {},
    user: "Hi, I want to go to Japan for the first time.",
    expect: { notTools: ["plan_days", "propose_route"], mustMatch: [/\?/], proposal: "none" },
  },
  {
    id: "onboard-answers",
    intent: "Answers in one message are saved, not asked again.",
    setup: {},
    user: "Ten nights from 20 November 2026, two of us, standard pace. We like temples and history, some nature but no hiking and no beaches. We'll get up early to beat crowds.",
    expect: { tools: ["set_preferences", "set_trip_dates"], mustNotMatch: [/what (are|is) your (pace|interests)/i], proposal: "none" },
  },
  {
    id: "onboard-max-seven",
    intent: "Never more than seven questions.",
    setup: {},
    user: "Help me plan.",
    expect: { notTools: ["plan_days"], mustNotMatch: [/(\?[^?]*){8,}/] },
  },
  {
    id: "onboard-skip",
    intent: "Skipping a question is allowed and respected.",
    setup: { trip: nov },
    user: "I'd rather not say my budget. Standard pace, temples and food, no hiking.",
    expect: { tools: ["set_preferences"], mustNotMatch: [/budget\?/i] },
  },

  // ------------------------------------------------------------- routes
  {
    id: "route-overpacked",
    intent: "Five cities in nine nights is refused with the arithmetic shown.",
    setup: { trip: nov, prefs: owner },
    user: "I want Osaka, Kyoto, Nara, Himeji and Hiroshima, two nights each apart from Himeji.",
    expect: { tools: ["assess_route"], mustMatch: [/\d+ city changes|\d+ (nights|nights per city)/i, /train/i], mustNotMatch: [/good plan|sounds great/i] },
  },
  {
    id: "route-overpacked-no-propose",
    intent: "An over-packed route is not proposed as asked; the cut is.",
    setup: { trip: nov, prefs: owner },
    user: "Book it in: Osaka 2, Kyoto 2, Nara 2, Himeji 1, Hiroshima 2.",
    expect: { tools: ["assess_route"], mustMatch: [/overpacked|too many|too much moving|drop|cut/i] },
  },
  {
    id: "route-suggest",
    intent: "With no route in mind, the corridor suggestion is used and assessed.",
    setup: { trip: nov, prefs: owner },
    user: "Where should we go? We have no idea.",
    expect: { tools: ["suggest_route"], mustMatch: [/Kyoto/, /night/i] },
  },
  {
    id: "route-propose",
    intent: "A sensible route becomes a proposal, not an applied change.",
    setup: { trip: nov, prefs: owner },
    user: "Let's do Osaka for two nights, then Kyoto for five, then Hiroshima for two. Set that up.",
    expect: { tools: ["assess_route", "propose_route"], proposal: "route", mustNotMatch: [/(is|are) now (set|in the plan|booked)/i] },
  },
  {
    id: "route-tier-stated",
    intent: "Coverage tier is stated per city.",
    setup: { trip: nov, prefs: owner },
    user: "What about Kyoto and Takayama, five nights each?",
    expect: { tools: ["assess_route"], mustMatch: [/Takayama/, /don't know|do not know|not (yet )?(covered|well enough)|stub/i] },
  },
  {
    id: "route-nara-daytrip",
    intent: "Nara is offered as a day trip, not a night.",
    setup: { trip: nov, prefs: owner },
    user: "Should we stay a night in Nara?",
    expect: { mustMatch: [/day trip|day-trip|from Kyoto|45 min|45 minutes/i] },
  },
  {
    id: "route-dates-missing",
    intent: "Without dates, the route question asks for them first.",
    setup: { prefs: owner },
    user: "Plan me a route.",
    expect: { notTools: ["propose_route", "plan_days"], mustMatch: [/date|when|how many nights/i] },
  },

  // ---------------------------------------------------------------- days
  {
    id: "days-plan",
    intent: "Planning the days goes through the engine and comes back as a proposal.",
    setup: routed,
    user: "Plan our days.",
    expect: { tools: ["plan_days"], proposal: "days", mustNotMatch: [/(are|is) now (in|on) (your|the) (plan|itinerary)/i] },
  },
  {
    id: "days-no-route",
    intent: "Days cannot be planned before a route exists.",
    setup: { trip: nov, prefs: owner },
    user: "Plan our days.",
    expect: { notTools: ["plan_days"], mustMatch: [/route|cities|where/i], proposal: "none" },
  },
  {
    id: "days-stub-city",
    intent: "A day in a stub city is declined plainly, never faked.",
    setup: { trip: nov, prefs: owner, cities: [{ cityId: "takayama", nights: 9 }] },
    user: "Plan our days in Takayama.",
    expect: { mustMatch: [/don't know|do not know|not well enough|can't plan|cannot plan/i], proposal: "none", mustNotMatch: [/\b(09|10|11):[0-5]\d\b/] },
  },
  {
    id: "days-explains-not-lists",
    intent: "The narration names decisions, not every stop.",
    setup: routed,
    user: "Plan the Kyoto days.",
    expect: { tools: ["plan_days"], proposal: "days", mustNotMatch: [/(\d{2}:\d{2}[^\n]*\n){9,}/] },
  },
  {
    id: "days-one-date",
    intent: "One date can be planned on its own.",
    setup: routed,
    user: "Just plan 23 November for now.",
    expect: { tools: ["plan_days"], proposal: "days" },
  },
  {
    id: "days-nara-trip",
    intent: "A day trip is a plan_days call with a city override.",
    setup: routed,
    user: "Make the 24th a day trip to Nara.",
    expect: { tools: ["plan_days"], proposal: "days", mustMatch: [/Nara/] },
  },

  // ------------------------------------------------------------- changes
  {
    id: "change-too-many-temples",
    intent: "'Too many temples' becomes a re-plan that avoids the category, not a lecture.",
    setup: {
      ...routed,
      days: [{ date: "2026-11-23", cityId: "kyoto-city", items: [
        { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 420, durationMin: 90, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
        { placeId: "kyt-kodaiji", name: "Kodai-ji", sortOrder: 1, startMin: 540, durationMin: 60, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
        { placeId: "kyt-kennin-ji", name: "Kennin-ji", sortOrder: 2, startMin: 660, durationMin: 45, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
        { placeId: "kyt-chionin", name: "Chion-in", sortOrder: 3, startMin: 780, durationMin: 60, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      ] }],
    },
    user: "The 23rd is too many temples.",
    expect: { tools: ["replan_day"], proposal: "days" },
  },
  {
    id: "change-pin-time",
    intent: "A timed wish becomes a pin, and the rest re-plans around it.",
    setup: {
      ...routed,
      days: [{ date: "2026-11-23", cityId: "kyoto-city", items: [
        { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 420, durationMin: 90, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
        { placeId: "kyt-nishiki-market", name: "Nishiki Market", sortOrder: 1, startMin: 600, durationMin: 60, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      ] }],
    },
    user: "I want to be at Sanjusangen-do at 10 on the 23rd.",
    expect: { tools: ["replan_day"], proposal: "days" },
  },
  {
    id: "change-remove",
    intent: "'Drop X' removes X and only X is guaranteed gone.",
    setup: {
      ...routed,
      days: [{ date: "2026-11-23", cityId: "kyoto-city", items: [
        { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 420, durationMin: 90, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
        { placeId: "kyt-nishiki-market", name: "Nishiki Market", sortOrder: 1, startMin: 600, durationMin: 60, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      ] }],
    },
    user: "Drop the market on the 23rd.",
    expect: { tools: ["replan_day"], proposal: "days" },
  },
  {
    id: "change-start-later",
    intent: "'We're not morning people' re-plans with a later start, no argument.",
    setup: {
      ...routed,
      days: [{ date: "2026-11-23", cityId: "kyoto-city", items: [
        { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 420, durationMin: 90, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      ] }],
    },
    user: "We are not starting at 7am on the 23rd. Make it 10.",
    expect: { tools: ["replan_day"], proposal: "days" },
  },
  {
    id: "change-no-regenerate",
    intent: "A change to one day does not re-plan the others.",
    setup: {
      ...routed,
      days: [
        { date: "2026-11-23", cityId: "kyoto-city", items: [{ placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 420, durationMin: 90, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null }] },
        { date: "2026-11-24", cityId: "kyoto-city", items: [{ placeId: "kyt-kinkakuji", name: "Kinkaku-ji", sortOrder: 0, startMin: 540, durationMin: 45, locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null }] },
      ],
    },
    user: "Swap Kiyomizu-dera out on the 23rd.",
    expect: { tools: ["replan_day"], notTools: ["plan_days"], proposal: "days" },
  },

  // --------------------------------------------------------------- facts
  {
    id: "fact-lookup",
    intent: "Describing a place goes through get_place and quotes the record.",
    setup: routed,
    user: "What's Fushimi Inari like?",
    expect: { tools: ["get_place"], mustMatch: [/6 ?am|before 08:00|early|dawn/i] },
  },
  {
    id: "fact-unknown-place",
    intent: "A place not in the database is not invented.",
    setup: routed,
    user: "How long do I need at the Tokyo Skytree?",
    expect: { tools: ["get_place"], mustMatch: [/don't have|do not have|not in|don't know|can't say|cannot say/i], mustNotMatch: [/\b\d+ ?(minutes|hours|min)\b/] },
  },
  {
    id: "fact-hours-monday",
    intent: "'Is it open Monday' is answered from closed days, not from memory.",
    setup: routed,
    user: "Is the Kyoto National Museum open on Mondays?",
    expect: { tools: ["get_place"], mustMatch: [/closed|not open/i, /Monday/i] },
  },
  {
    id: "fact-journey",
    intent: "A journey is described from the graph, with the trap.",
    setup: routed,
    user: "How do we get from Kyoto Station to Fushimi Inari?",
    expect: { tools: ["route_between"], mustMatch: [/Nara Line/i, /Rapid/i] },
  },
  {
    id: "fact-fare-estimate",
    intent: "An estimated fare stays an estimate in the prose.",
    setup: routed,
    user: "How much is the train from Kyoto to Arashiyama?",
    expect: { tools: ["route_between"], mustMatch: [/about|around|roughly|~|approximately|estimate/i] },
  },
  {
    id: "fact-no-live",
    intent: "Live status is out of scope and said to be.",
    setup: routed,
    user: "Is the Shinkansen running normally today?",
    expect: { notTools: ["plan_days", "replan_day"], mustMatch: [/can't|cannot|don't (have|know)|not (able|something I)|official|live/i] },
  },

  // --------------------------------------------------------------- voice
  {
    id: "voice-no-flattery",
    intent: "Agreeing with a bad plan is the failure mode.",
    setup: { trip: nov, prefs: owner },
    user: "I'm thinking Tokyo, Kyoto, Osaka, Hiroshima, Fukuoka and Sapporo in nine nights. Good plan, right?",
    expect: { mustNotMatch: [/great plan|sounds good|good plan/i], mustMatch: [/too many|too much|overpacked|over-packed|\bdrop\b|\bcut\b|won't work|does not work|doesn't work/i] },
  },
  {
    id: "voice-short",
    intent: "A simple question gets a short answer.",
    setup: routed,
    user: "Is Osaka worth two nights?",
    expect: { mustNotMatch: [/(\n[^\n]+){9,}/], mustMatch: [noExclaim] },
  },
  {
    id: "voice-who",
    intent: "Asked who it is, it says so plainly.",
    setup: routed,
    user: "Who are you?",
    expect: { mustMatch: [/Bento Man/], mustNotMatch: [/as an ai|language model/i] },
  },
];
