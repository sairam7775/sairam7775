/** Every word the app shows, in English. Change a line here and the page
 *  changes with it. Grouped by screen; a sentence with something filled in
 *  (a name, a date) is a small function, so the whole sentence — word order
 *  included — stays here.
 *
 *  Voice (DESIGN.md): plain sentences, no cheerleading, no internal words.
 *  `copy.test.ts` checks every line is filled in and free of jargon. */

/** Who runs Bento, as the legal pages name them. Until the business is
 *  registered this is the trade name alone: the owner's name and postal
 *  address are given to anyone who asks, which Japan's privacy law allows.
 *  Change it here once registered, and the pages follow. */
const OPERATOR = "Bento Man";
const CONTACT = "bentoman.me@gmail.com";
const MIN_AGE = 16;
const nightCount = (n: number) => `${n} night${n === 1 ? "" : "s"}`;

export const en = {
  /** How dates and numbers are written (a BCP 47 tag, for toLocaleDateString). */
  locale: "en-GB",

  meta: {
    title: "Bento — plan Japan properly",
    description:
      "A trip planner for people who have never been to Japan. The travel time between every stop, honest expectations, and a plan that tells you what's still missing.",
  },

  common: {
    home: "Home",
    homeBack: "← Home",
    homeLabel: "Bento home",
    yourTrips: "Your trips",
    tripsHomeLabel: "Bento — your trips",
    settings: "Settings",
    signIn: "Sign in",
    signOut: "Sign out",
    saving: "Saving…",
    tryAgain: "Try again",
    or: "or",
    reference: (digest: string) => `Reference: ${digest}`,
  },

  form: {
    showPassword: "Show password",
    hidePassword: "Hide password",
    show: "Show",
    hide: "Hide",
  },

  loading: {
    label: "Loading",
    packing: "Packing the box…",
    trip: "Loading your trip",
    vault: "Checking your bookings…",
  },

  status: {
    notFound: {
      kicker: "404",
      title: "Nothing in this box.",
      body: "That page doesn’t exist, or the trip isn’t yours to open. Check the link, or go back to your trips.",
    },
    error: {
      kicker: "Something went wrong",
      title: "That didn’t load.",
      body: "It’s on our side, not yours, and nothing in your plan was changed. Try again — if it keeps happening, come back in a few minutes.",
    },
    globalError: {
      title: "Bento didn’t load.",
      body: "Something went wrong on our side. Nothing in your plan was changed. Try again in a moment.",
    },
  },

  auth: {
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordHint: "At least 8 characters.",
    google: "Continue with Google",
    orEmail: "or with your email",

    signIn: {
      title: "Welcome back",
      subtitle: "Sign in to pick up where you left off — your route, your days, and what’s still missing.",
      greeting: "おかえりなさい",
      greetingMeaning: "“Welcome home” — what a ryokan says when you come back in from the cold.",
      points: {
        plan: { title: "Your plan, as you left it", body: "Every accepted day, every pinned stop, and the conversation with Bento Man." },
        gaps: { title: "The gaps, still flagged", body: "A night with no bed or a train with no ticket stays on the list until it’s booked." },
        bookings: { title: "Bookings in one place", body: "Confirmation numbers are encrypted, and shown only to you." },
      },
      // Begins the agreement line under Continue with Google, which creates an account for a new address.
      googleAgree: "New to Bento? Continuing with Google creates your account, and you agree to the",
      forgot: "Forgot password?",
      submit: "Sign in",
      pending: "Signing in…",
      newHere: "New to Bento?",
      createAccount: "Create an account",
    },

    signUp: {
      title: "Start planning",
      subtitle: "An account keeps your plan — and the confirmation numbers you add to it — here tomorrow, and on your phone in Japan.",
      greeting: "はじめまして",
      greetingMeaning: "“Nice to meet you” — said once, at the start.",
      points: {
        tell: { title: "Tell Bento Man the trip", body: "Dates, who’s going, what you like and what you’d never do. A few questions, not a form." },
        route: { title: "Get a route that adds up", body: "Cities and nights with the train time shown. An over-packed plan is flagged, with the arithmetic." },
        days: { title: "Each day as a box", body: "Stops sized to the time they take. Nothing changes until you accept it." },
      },
      blocked: "Sorry, we can’t create an account for you.",
      birthdate: "Date of birth",
      birthdateHint: "We use this once, to check you can sign up, and don’t keep it.",
      continue: "Continue",
      checking: "Checking…",
      sent: "Check your email for a confirmation link, then come back and sign in.",
      submit: "Create account",
      pending: "Creating your account…",
      haveAccount: "Already have an account?",
      name: "What should Bento call you?",
      nameHint: "Optional. Only used to greet you; you can change it in Settings.",
      // One sentence with two links: start, terms link, middle, privacy link, end.
      agree: {
        start: "By creating an account you agree to the",
        terms: "terms of use",
        middle: "and to how Bento handles your data, set out in the",
        privacy: "privacy policy",
        end: ".",
      },
    },

    forgot: {
      title: "Reset your password",
      subtitle: "Enter the email you signed up with and we'll send a link to choose a new password.",
      points: {
        once: { title: "The link works once", body: "It signs you in and asks for a new password. It expires after an hour." },
        unchanged: { title: "Nothing in your plan changes", body: "Trips, bookings and the conversation with Bento Man stay exactly as they are." },
      },
      sent: "If there’s an account for that address, a reset link is on its way. Check your inbox — and spam — in the next few minutes.",
      submit: "Send reset link",
      again: "Send another link",
      pending: "Sending…",
      remembered: "Remembered it?",
    },

    changePassword: {
      resetTitle: "Choose a new password",
      changeTitle: "Change password",
      resetSubtitle: "You're signed in from the reset link. Pick a password you haven't used here before.",
      changeSubtitle: "At least 8 characters.",
      current: "Current password",
      new: "New password",
      again: "New password again",
      submit: "Save password",
      forgotCurrent: "Forgot your current one?",
      resetByEmail: "Reset it by email",
    },

    // Messages shown back on the form after a server check.
    errors: {
      badEmail: "That doesn't look like an email address.",
      shortPassword: "Passwords need at least 8 characters.",
      longPassword: "Passwords can be at most 72 characters.",
      mismatch: "The two passwords don't match.",
      wrongPassword: "That email and password don't match.",
      wrongCurrent: "Your current password isn't right.",
      noBirthdate: "Enter your date of birth.",
      googleOff: "Google sign-in isn't available yet. Use your email and password.",
      googleBlocked: "Sorry, you can't use Bento.",
      googleAgeFirst: "Before continuing with Google, confirm your date of birth — it's asked once, and not kept.",
      googleDown: "Google sign-in is unavailable right now.",
      resetSendFailed: "We couldn't send the reset email just now. Try again in a few minutes.",
      resetExpired: "Your reset link expired. Ask for a new one.",
      linkIncomplete: "That link is incomplete. Try signing in again.",
      linkOtherBrowser: (reset: boolean) =>
        `That ${reset ? "reset" : "sign-in"} link was opened in a different browser from the one that asked for it. Open it there, or ask for a new one.`,
      resetLinkUsed: "That reset link has expired or was already used. Ask for a new one.",
      signInLinkUsed: "That sign-in link has expired or was already used. Try signing in again.",
    },

    // Supabase's error codes, in words. Anything not listed gets `fallback`.
    supabase: {
      user_already_exists: "There's already an account with that email. Sign in instead, or reset your password.",
      email_exists: "There's already an account with that email. Sign in instead, or reset your password.",
      weak_password: "That password is too easy to guess. Use at least 8 characters with a mix of letters and numbers.",
      same_password: "That's your current password. Choose a new one.",
      email_address_invalid: "That email address can't be used. Check it for typos.",
      email_not_confirmed: "Confirm your email first — the link is in your inbox (check spam too).",
      over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
      over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
      signup_disabled: "New sign-ups are paused right now. Try again later.",
      session_expired: "Your session expired. Sign in again.",
      session_not_found: "Your session expired. Sign in again.",
      reauthentication_needed: "For your security, sign in again before changing your password.",
    } satisfies Record<string, string>,
    unknownError: "Something went wrong. Try again.",
    serverError: "Something went wrong on our side. Try again in a moment.",
  },

  // `doing` finishes "Couldn't …", e.g. "save the trip".
  db: {
    noAccess: (doing: string) => `Couldn't ${doing}: you don't have access to it. Sign in again if this keeps happening.`,
    exists: (doing: string) => `Couldn't ${doing}: it already exists.`,
    invalid: (doing: string) => `Couldn't ${doing}: something in the form isn't valid. Check the dates and numbers.`,
    failed: (doing: string) => `Couldn't ${doing}. Try again in a moment.`,
  },

  home: {
    howItWorksLink: "How it works",
    yourTripsCta: "Your trips →",
    // Beside "Your trips →" when signed in.
    greeting: {
      named: (name: string) => `Welcome back, ${name}.`,
      plain: "Welcome back.",
    },
    startPlanning: "Start planning",
    hero: {
      kicker: "For your first trip to Japan",
      kickerJa: "弁当",
      title: "Plan Japan like you’ve been before.",
      body: "Bento is a trip planner that tells you the honest version — how long each place takes, which trains get you there, and what’s still missing from your plan — the way a friend who lives there would.",
      note: "Bento suggests; you decide. Nothing changes in your plan until you say yes.",
    },
    how: {
      eyebrow: "How it works",
      title: "Three steps, one box",
      // Shown in this order. Named, not a list, so a language can't drop one.
      steps: {
        tell: { title: "Tell Bento Man the trip", body: "Your dates, who’s going, what you love and what you’d never do. A few questions in a chat, not a long form." },
        route: { title: "Get a route that adds up", body: "Cities and nights in order, with the train time between them. If it’s too much, it says so — with the arithmetic." },
        days: { title: "Open each day like a box", body: "Every stop sized to the time it takes, the train written between them. Pin, reorder, or ask for a re-plan." },
      },
    },
    different: {
      eyebrow: "What it does differently",
      title: "Honest, not exhaustive",
      durations: { title: "Time on the ground, not listings", body: "Fushimi Inari is 45 minutes to the gates and three hours to the summit. Which one you have time for changes the day." },
      honest: { title: "It admits what it doesn’t know", body: "Every city says how well it’s covered. A thin guess dressed up as a plan is the one thing this won’t do." },
      gaps: { title: "It finds the gaps", body: "The night you have no hotel, the leg with no train, the ticket whose booking window closes next week." },
    },
    coverage: {
      eyebrow: "Where it knows best today",
      title: "The Kansai–Sanyo corridor",
      body: "The trains between these cities, with their times and fares, and the cities most first trips are built on, where place-by-place detail is being added now. The rest of Japan is on the map too — and each city tells you how much Bento really knows about it.",
      // Each city: its name, then its name in Japanese.
      cities: {
        kyoto: { name: "Kyoto", ja: "京都" },
        osaka: { name: "Osaka", ja: "大阪" },
        nara: { name: "Nara", ja: "奈良" },
        himeji: { name: "Himeji", ja: "姫路" },
        hiroshima: { name: "Hiroshima", ja: "広島" },
        miyajima: { name: "Miyajima", ja: "宮島" },
      },
    },
    closing: {
      title: "Your first trip, without the guesswork.",
      body: "Start with your dates. Bento Man takes it from there.",
    },
    footer: "Bento — Japan, planned properly",
    footerJa: "いってらっしゃい",
    // The sample day beside the headline: an illustration, not real data.
    preview: {
      caption: "An example of a day in Bento: Kyoto, four stops from 7:30, with the reason for each.",
      date: "Sunday 22 November",
      summary: "Kyoto · 6h 40m",
      stops: {
        inari: { time: "07:30", name: "Fushimi Inari Taisha", why: "Before the tour groups — the lower gates are quiet until about 8." },
        tofukuji: { time: "10:20", name: "Tofuku-ji", why: "Two stops south. The bridge view is the point." },
        lunch: { time: "12:30", name: "Lunch near Kyoto Station", why: null as string | null },
        sanjusangendo: { time: "14:00", name: "Sanjusangen-do", why: "1,001 statues in one hall. Shoes off; allow an hour." },
      },
      bentoMan: "Arashiyama is the other side of the city — fifty minutes each way. I’ve left it for Tuesday, when you’re already west.",
    },
  },

  trips: {
    title: "Your trips",
    signedInAs: "Signed in as",
    // Above the title: Japanese first, then its meaning. `first` before any trip exists.
    greeting: {
      returning: {
        ja: "おかえりなさい",
        named: (name: string) => `Welcome back, ${name}.`,
        plain: "Welcome back.",
      },
      first: {
        ja: "はじめまして",
        named: (name: string) => `Nice to meet you, ${name}.`,
        plain: "Nice to meet you.",
      },
    },
    untitled: "Untitled trip",
    noDates: "No dates yet",
    /** A trip's dates as shown in the list, from dates already written out. */
    range: (from: string, to: string, nights: number) => `${from} – ${to} · ${nights} night${nights === 1 ? "" : "s"}`,
    people: (n: number) => `${n} people`,
    delete: "Delete",
    deleteLabel: (title: string) => `Delete ${title}`,
    deleteConfirm: (title: string) => `Delete “${title}”? Its route, days, chat and bookings go with it. This can’t be undone.`,
    empty: "No trips yet. Start one below — dates can come later.",
    new: {
      body: "Everything here is optional and can be changed later — you can also just tell Bento Man.",
      name: "Name it",
      namePlaceholder: "Kansai, autumn",
      arrive: "Arrive in Japan",
      leave: "Leave Japan",
      people: "People travelling",
      datesInWords: {
        arrival: (date: string) => `Arrive ${date}`,
        departure: (date: string) => `Leave ${date}`,
        range: (from: string, to: string, nights: number) => `${from} → ${to} · ${nightCount(nights)}`,
      },
      submit: "Create trip",
      pending: "Creating…",
    },
    // The guided way in: a few questions, then Bento Man with a first
    // message written from the answers. The blank form stays beside it.
    guided: {
      cardTitle: "Plan a Japan trip",
      cardBody: "Not sure of dates or places yet? Answer a few questions — roughly when, who, your pace and what you like — and Bento Man suggests a route. Nothing is fixed until you accept it.",
      cardCta: "Plan a Japan trip →",
      blankTitle: "Or start a blank trip",
      title: "Plan a Japan trip",
      intro: "Answer what you can. All of it is optional and can change later.",
      when: {
        legend: "When are you going?",
        dates: "I know my dates",
        rough: "Roughly",
        unsure: "Not sure yet",
        month: "Month",
        nights: "About how many nights",
        nightsPlaceholder: "e.g. 10",
      },
      people: "How many of you?",
      pace: { legend: "Your pace", relaxed: "Relaxed", standard: "Standard", packed: "Packed" },
      paceHints: { relaxed: "Fewer stops, long lunches", standard: "A full day with breaks", packed: "As much as fits" },
      interests: "What do you like?",
      places: "Places you have in mind",
      placesPlaceholder: "Kyoto, Hiroshima…",
      avoid: "Anything you'd rather avoid?",
      avoidPlaceholder: "Long hikes, crowds…",
      submit: "Start planning with Bento Man",
      pending: "Starting…",
      // A rough trip's name, so the trips list still says when.
      roughTitle: (month: string, nights: number | null) => (nights ? `${month}, about ${nightCount(nights)}` : month),
      // The first message, put in Bento Man's box for the traveller to send.
      starter: {
        aboutNights: (nights: number, month: string) => `About ${nightCount(nights)} in ${month}`,
        inMonth: (month: string) => `Sometime in ${month}`,
        unsure: "We don't know our dates yet",
        dates: "Our dates are in the trip",
        people: (n: number) => (n === 1 ? "just me" : `${n} of us`),
        places: (places: string) => `Places in mind: ${places}.`,
        avoid: (avoid: string) => `We'd rather avoid: ${avoid}.`,
        ask: "Can you suggest a route?",
      },
      errors: {
        month: "Pick a month, or choose another answer for when.",
        nights: "Nights should be between 1 and 30.",
        failed: "That didn't start. Try again in a moment.",
      },
    },
    errors: {
      longTitle: "Keep the trip name under 120 characters.",
      wholePeople: "People travelling should be a whole number.",
      minPeople: "At least one person is travelling.",
      maxPeople: "Bento plans for up to 20 people.",
      endBeforeStart: "The end date is before the start date.",
      saveFailed: "Couldn't save the trip.",
      create: "create the trip",
    },
    /** On an ended trip nobody has reviewed yet. */
    reviewAsk: "How did it go?",
  },

  // After a trip ends: did the plan work? (lib/trips/review.ts, 0019)
  review: {
    heading: "How did the plan hold up?",
    intro: "Your trip has ended. Tell us whether you could follow the plan and what got in the way, so Bento plans better next time. Only the first question is needed.",
    outcomeLabel: "Could you follow the plan?",
    outcomes: {
      as_planned: "Yes, it went to plan",
      mostly: "Mostly, with some changes",
      not_really: "Not really",
    },
    challengesLabel: "What got in the way?",
    challenges: {
      too_much: "Too much in one day",
      travel_longer: "Getting around took longer than planned",
      place_closed: "A place was closed or not as described",
      crowds: "Crowds were worse than expected",
      booking: "A booking or ticket problem",
      walking: "Too much walking",
      timing: "The times didn't suit us",
      other: "Something else",
    },
    hardDaysLabel: "Which days were hardest to follow?",
    hardDay: (day: number, date: string, city: string) => `Day ${day} · ${date} · ${city}`,
    hardDayNoCity: (day: number, date: string) => `Day ${day} · ${date}`,
    noteLabel: "Anything else?",
    notePlaceholder: "What happened, what you changed, what you'd want Bento to know",
    send: "Send",
    update: "Save changes",
    sending: "Sending…",
    thanks: (outcome: string) => `Thanks for telling us how it went. You said: ${outcome}.`,
    change: "Change your answer",
    privacy: "Your answer is kept with this trip and read by the people who build Bento. It's deleted with the trip or your account.",
    errors: {
      outcome: "Choose whether you could follow the plan.",
      noteTooLong: (max: number) => `Keep it under ${max} characters.`,
      dayOutside: "Pick days from this trip.",
      tooManyDays: (max: number) => `Pick up to ${max} days.`,
      notYet: "You can say how it went once the trip has ended.",
      saveFailed: "Couldn't save your answer. Try again.",
    },
  },

  // Lengths of time, as the plan shows them: "45m", "2h", "3h 20m".
  time: {
    duration: (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}` : `${min}m`),
    minutes: (min: number) => `${min} min`,
    noTime: "--:--",
    none: "—",
  },

  // How much Bento knows about a city, in words.
  coverage: {
    deep: "Well covered",
    outline: "Main sights only",
    stub: "Not covered yet",
  },

  trip: {
    planLabel: "The plan",
    daysLabel: "Days",
    nights: nightCount,
    dateRange: (from: string, to: string, nights: number) => `${from} – ${to} · ${nights} night${nights === 1 ? "" : "s"}`,
    // The line under the title: "Kyoto, 4 nights → Nara, day trip. 2 travelling. Relaxed pace."
    cityNights: (city: string, nights: number) => `${city}, ${nights} night${nights === 1 ? "" : "s"}`,
    cityDayTrip: (city: string) => `${city}, day trip`,
    route: (stops: string) => `${stops}.`,
    routeJoin: " → ",
    noRoute: "No route yet. Tell Bento Man the dates and what kind of trip this is.",
    travelling: (n: number) => `${n} travelling.`,
    pace: {
      relaxed: "Relaxed pace.",
      standard: "Standard pace.",
      packed: "Packed pace.",
    },
    edit: {
      open: "Edit trip",
      addDates: "Add dates",
      name: "Trip name",
      moveNote: "Changing dates moves your route and your planned days with it. Day plans still waiting for an answer in the chat are closed, since they were made for the old dates. The new dates need room for every night of the route.",
      save: "Save",
      datesAuto: "Bento Man changes your dates without asking.",
      datesAsk: "Bento Man asks before changing your dates.",
      askFirst: "Ask me first",
      dontAsk: "Don't ask",
      settingFailed: "That setting didn't save. Try again.",
    },
    askBentoMan: "Ask Bento Man",
    closeBentoMan: "Close",
    bookingsBar: {
      blocking: (n: number) => `${n} blocking`,
      label: "Bookings",
      allBeds: (covered: number, total: number) => `Every night has a bed. ${covered} of ${total} covered.`,
      noDates: "Flights, hotels and tickets — keep them here, and see what’s still missing once the trip has dates.",
      open: "Bookings →",
    },
    dayTab: (n: number, weekday: string) => `Day ${n} · ${weekday}`,
    dayStats: (stops: number, active: string) => `${stops} stop${stops === 1 ? "" : "s"} · ${active} active`,
    // A moving day's trains, above its box: from Bento's own train data.
    travelDay: {
      label: "Travel day",
      estimate: "A ~ before a fare means it's an estimate.",
      tickets: "Keep the tickets in Bookings →",
      directions: "Directions",
      openDirections: (from: string, to: string) => `Open directions from ${from} to ${to} in Google Maps`,
    },
    emptyBox: {
      title: "An empty box.",
      body: "Give Bento Man the dates and a route and each day gets a compartment here, sized to the time it takes.",
    },
    proposals: {
      answered: "That proposal has already been answered.",
      unreadable: "That proposal can't be read any more. Ask Bento Man again.",
      notApplied: (why: string) => `That didn't apply: ${why}`,
      notAppliedUnknown: "it couldn't be saved",
      rememberFailed: "The dates changed, but \"don't ask again\" didn't save. Try it from Edit trip.",
    },
    replan: {
      // Bento Man's message in the chat when a day is re-planned.
      message: (day: string, pinned: number, summary: string) =>
        `Re-planned ${day}${pinned ? ` around the ${pinned} stop${pinned === 1 ? "" : "s"} you pinned` : ""}. ${summary}. Accept it to replace the day, or reject it and keep what you have.`,
      summary: (day: string) => `${day} re-planned`,
    },
  },

  day: {
    lunch: "Lunch",
    lunchNote: "Nothing booked, and nothing needs to be. Bring cash.",
    map: "Map",
    openMap: (name: string) => `Open ${name} in Google Maps`,
    budgetEndsLabel: "Day budget ends here",
    budgetEnds: (budget: string) => `${budget} day ends here`,
    pinned: "pinned",
    over: "over",
    clashesWith: (titles: string) => `clashes with ${titles}`,
    pin: "Pin",
    unpin: "Unpin",
    pinHint: "Keep this exactly here",
    unpinHint: "Let Bento move this",
    moveEarlier: (name: string) => `Move ${name} earlier`,
    moveLater: (name: string) => `Move ${name} later`,
    remove: "Remove",
    removeLabel: (name: string) => `Remove ${name}`,
    removeConfirm: (name: string) => `Remove ${name} from this day?`,
    emptyWithBookings: (city: string) => `No planned stops yet. Ask Bento Man to plan ${city} around your bookings.`,
    empty: (city: string) => `Nothing in this box yet. Ask Bento Man to plan ${city}, or re-plan the day.`,
    // A day in a city Bento can't plan yet: what still works here, then why
    // the box stays empty. Never "drag to reorder" on stops that can't come.
    uncovered: (city: string) => `Your bookings for this day go here. Bento can't plan days in ${city} yet, so it won't add stops.`,
    uncoveredHowTo: "Drag your bookings for the day in from Bookings, and ask Bento Man about the trains.",
    budget: "Day budget",
    of: (budget: string) => `of ${budget}`,
    overBy: (over: string) => `${over} over`,
    slack: (slack: string) => `${slack} slack`,
    ringLabel: (pct: number) => `${pct}% of the day`,
    pinnedCount: (n: number) => `${n} pinned. `,
    howTo: "Drag to reorder, pin what must stay, remove what you don’t want. Times follow.",
    replan: "Re-plan this day",
    replanNote: "Bento chooses again around your pins. It comes back as a proposal you can reject.",
    // Why a stop was chosen, as small tags under it.
    reasons: {
      interest_match: "your interests",
      signature: "signature",
      season_fit: "in season",
      discovery_fit: "off the list",
      crowd: "quiet hours",
      redundancy: "variety",
      energy: "easy going",
      budget_strain: "budget",
      pace_strain: "pace",
      confidence: "verified",
      skip_if: "flagged",
    } satisfies Record<string, string>,
  },

  bookings: {
    heading: "Bookings",
    all: "All bookings →",
    howTo: (day: string) => `Drag one into the day, or tap Add. Only bookings for ${day} fit in this day.`,
    emptyBefore: "No bookings yet. Add flights, hotels and tickets in",
    emptyLink: "Bookings",
    emptyAfter: ", then put them in their day.",
    noDate: "No date yet",
    range: (from: string, to: string) => `${from} – ${to}`,
    kinds: {
      flight: "Flight",
      accommodation: "Stay",
      transport: "Transport",
      activity: "Ticket",
      restaurant: "Restaurant",
      other: "Booking",
    } satisfies Record<string, string>,
    inThisDay: "In this day",
    takeOut: "Take out",
    takeOutLabel: (title: string) => `Take ${title} out of this day`,
    addDate: "Add a date to plan it",
    add: "Add to this day",
    inPlan: (day: string) => `In the plan · open ${day}`,
    notThisDay: (day: string) => `Not this day · open ${day}`,
    outsideTrip: "Outside this trip’s days",
    // In the box.
    booked: "Booked",
    timeNotGiven: "Time not given",
    checkIn: "Check-in",
    staying: "Staying",
    checkOut: "Check-out",
    ends: "Ends",
    allDay: "All day",
    // Messages after a drop or a tap.
    wrongDay: (title: string, when: string, day: string) => `“${title}” is for ${when}, so it can't go in ${day}.`,
    wrongDayHover: (title: string, when: string) => `Not this day. “${title}” is for ${when}.`,
    added: (title: string, when: string) => `“${title}” is in your plan for ${when}.`,
    removed: (title: string) => `“${title}” is out of your plan. It's still in Bookings.`,
    // From the server.
    badInput: "That booking or day isn't right. Reload the page and try again.",
    badBooking: "That booking isn't right. Reload the page and try again.",
    signedOut: "You're signed out. Sign in again to change your plan.",
    gone: "That booking isn't in this trip any more.",
    undated: (title: string) => `“${title}” has no date yet. Add one in Bookings, then put it in its day.`,
    isFor: (day: string) => `is for ${day}`,
    runs: (from: string, to: string) => `runs ${from} – ${to}`,
    cantGo: (title: string, when: string, day: string) => `“${title}” ${when}, so it can't go in ${day}.`,
    tripFailed: "That trip couldn't be loaded. Reload the page and try again.",
    notATripDay: (day: string) => `${day} isn't one of this trip's days.`,
    doingAdd: "add the booking",
    doingRemove: "take the booking out",
  },

  // The whole plan on one page, to save as a PDF (/trips/[id]/print).
  print: {
    download: "Download plan",
    pageTitle: (trip: string) => `${trip} · plan`,
    save: "Save as PDF",
    howTo: "Choose “Save as PDF” in the print window to keep a copy on your phone or computer. It opens without a connection.",
    back: "Back to the trip",
    saved: (date: string) => `Saved from Bento on ${date}. If you change the plan, download it again.`,
    link: "Open the latest version in Bento:",
    // While the trip is shared: the companions' link, which opens for anyone.
    linkShared: "Latest version, for everyone travelling:",
    checkNote: "The times, travel and opening hours here come from Bento's place and train information on the day you saved it. Places do sometimes change their hours or close for a holiday, so for anything you can't miss, a quick look before you set off is worth it.",
    people: (n: number) => `${n} travelling`,
    route: "Route",
    days: "Day by day",
    day: (n: number, date: string, city: string) => `Day ${n} · ${date} · ${city}`,
    nothingPlanned: "Nothing planned for this day.",
    getThere: (how: string) => `Getting there: ${how}`,
    station: (name: string, walk: number | null) => (walk != null ? `Nearest stop: ${name}, ${walk} min walk` : `Nearest stop: ${name}`),
    hours: (opens: string, closes: string) => `Open ${opens}–${closes}`,
    why: (reason: string) => `Why: ${reason}`,
    bookings: "Bookings",
    noBookings: "No bookings added yet.",
    noDate: "No date",
    at: (date: string, time: string) => `${date} ${time}`,
    timeSpan: (from: string, to: string) => `${from}–${to}`,
    endsAt: (date: string, time: string) => `${date}, ends ${time}`,
    loadFailed: "Bento couldn't load the whole plan, so there's nothing to save yet. Try again in a moment.",
    referencesNote: "Booking reference numbers are not in this download. They stay encrypted in Bento: open the trip's Bookings page to see them.",
  },

  proposal: {
    heading: "Proposal",
    status: {
      proposed: "Proposed",
      accepted: "Accepted",
      rejected: "Rejected",
    },
    dates: "Dates",
    changesTo: " changes to ",
    travelling: (n: number) => `${n} travelling`,
    datesNote: "Your route and planned days move with the dates.",
    route: "Route",
    dayTrip: "day trip",
    // What Bento can plan in each city of a route, said in full.
    canPlan: {
      deep: "Well covered: Bento can build full days here.",
      outline: "Main sights only: Bento can suggest places here, but won't call a day complete.",
      // No train promise here: a stop outside Bento's train data has none,
      // and the Trains list below says which journeys Bento knows.
      stub: "Not covered yet: Bento can't plan days here yet.",
    },
    // When every stop is known equally well: said once, under the route. A
    // route Bento knows none of is explained by `limits` instead.
    canPlanEverywhere: {
      deep: "Every stop is well covered: Bento can build full days in each.",
      outline: "Main sights only, at every stop: Bento can suggest places, but won't call a day complete.",
      // A route of day trips only, none of them covered (no note above Accept).
      // With nowhere to sleep there are no journeys to show, so no trains are promised.
      stub: "Not covered yet, at every stop: Bento can't plan days at any of them yet.",
    },
    trains: "Trains",
    thereAndBack: "there and back",
    // Under a route whose stays include places Bento can't plan yet. What
    // works comes first; `cities` arrives already joined ("Osaka or Kyoto").
    // `dated`: the trip has dates, so accepting also sets each stop's days.
    // `trains`: Bento's train data has at least one journey on this route.
    limits: (cities: string, all: boolean, dated: boolean, trains: boolean) =>
      `Accepting sets your route${dated ? " and dates" : ""}${trains ? ", with the trains Bento knows between your stops" : ""}. Bento can't plan days in ${all ? "any of these places" : cities} yet, so ${dated ? "those days stay" : "your days there will stay"} open for you to fill.`,
    change: {
      kept: "kept",
      added: "new",
      moved: "moved",
      removed: "out",
    },
    pinned: "pinned",
    out: (names: string) => `Out: ${names}`,
    leftOut: "Left out, and why",
    overpacked: "Bento thinks this is too much moving for the nights you have.",
    accept: "Accept",
    acceptAnyway: "Accept anyway",
    accepting: "Applying…",
    /** Under a proposal the traveller has just accepted, beside Bento Man cheering. */
    inPlan: "It's in your plan.",
    remember: "Change dates without asking next time",
    reject: "Reject",
    rejecting: "Rejecting…",
  },

  // Sharing the plan by link with the people travelling (0020).
  share: {
    open: "Share plan",
    openOn: "Shared",
    intro: "Give the people travelling with you a link to this plan. They can open it without an account, and it always shows the latest version.",
    who: "Anyone with the link can see the route, the day plans and your bookings' names and times. Booking reference numbers are never shown. You can switch the link off at any time.",
    turnOn: "Share with companions",
    linkLabel: "Link for your companions",
    copy: "Copy",
    copied: "Copied",
    send: "Send…",
    preview: "See what they see",
    renew: "Make a new link",
    renewConfirm: "Make a new link? The current one stops working for everyone who has it.",
    stop: "Stop sharing",
    stopConfirm: "Stop sharing this plan? The link stops working for everyone who has it.",
    failed: "Couldn't change sharing for this trip. Try again in a moment.",
    printHint: "The link in this plan opens only for you. Share the trip to give your companions a link that works for them.",
    // The shared page.
    viewerNote: "A trip plan shared with you on Bento. This page always shows the latest version.",
    ownerNote: "This is what your companions see with the link.",
    backToTrip: "Back to your trip",
    // On the sheet itself, for companions, who can't change the plan or open its bookings.
    saved: (date: string) => `Saved from Bento on ${date}.`,
    referencesNote: "Booking reference numbers aren't shared. Ask whoever shared this plan if you need one.",
    loadFailed: "Bento couldn't load this plan just now. Try again in a moment.",
    gone: {
      title: "This link doesn't open a trip any more",
      body: "Whoever shared it may have switched it off or made a new one. Ask them for the latest link.",
    },
  },

  chat: {
    name: "Bento Man",
    tagline: "Plans the trip with you. Nothing changes until you accept it.",
    intro: "Tell Bento Man what kind of trip this is. Dates and how many nights are the useful first thing; the rest can come as you go.",
    tryThese: "Try one of these",
    examples: {
      trip: "Ten nights in November, first time, we like temples and food, no hiking.",
      route: "Suggest a route",
      days: "Plan my days",
    },
    inputLabel: "Message Bento Man",
    placeholder: "Ask Bento Man…",
    answering: "Bento Man is answering…",
    send: "Send",
    keys: "Enter to send · Shift + Enter for a new line",
    // Under the message box. What to rely on first, then the honest limit.
    trust: "Times, trains and opening hours come from Bento's own place and train information, not Bento Man's memory. Bento Man can sometimes word things wrongly: what your plan and proposals show is what counts.",
    thinking: "Thinking",
    working: "Working",
    // What Bento Man is doing while a reply is on its way.
    tools: {
      set_preferences: "Noting that down",
      set_trip_dates: "Setting the dates",
      assess_route: "Checking the route",
      propose_route: "Laying out the route",
      suggest_route: "Thinking about the route",
      plan_days: "Planning the days",
      replan_day: "Re-planning the day",
      get_place: "Looking that up",
      route_between: "Checking the trains",
    } satisfies Record<string, string>,
    noAnswer: (status: number) => `Bento Man didn't answer (${status}).`,
    offline: "Couldn't reach Bento Man. Check your connection and try again.",
    failed: "Something went wrong.",
  },

  vault: {
    back: "Plan",
    blocking: (n: number) => `${n} blocking`,
    title: "What’s still missing",
    intro: "Every night needs a bed, every move between cities needs a way to get there, and anything with a timed ticket needs the ticket. Nothing is fetched from airlines or hotels. This only knows what you put here, which is also why it can hold your reference numbers safely.",
    saved: "Saved.",
    noReferences: "Booking references can’t be saved right now. Everything else saves normally.",
    coverageLabel: "Coverage",
    gapsLabel: "Gaps",
    nothingMissing: {
      title: "Nothing is missing.",
      body: "Every night has a bed, every move has a way, and nothing on the plan needs a ticket you do not have.",
    },
    bookingsLabel: "Bookings",
    everything: "Everything you’ve booked",
    recorded: (n: number) => `${n} recorded`,
    groups: {
      flight: "Flights",
      transport: "Between cities",
      accommodation: "Where you sleep",
      activity: "Tickets",
      restaurant: "Tables",
      other: "Other",
    },
    noDates: "no dates recorded",
    referenceUnreadable: "This reference can't be shown: it was saved with an older key. Add it again from the confirmation.",
    remove: "Remove",
    removeConfirm: (title: string) => `Remove “${title}”? This can't be undone.`,
    // On each booking: the reference, masked until the traveller asks.
    referenceLabel: "Reference",
    referenceShow: "Show",
    empty: "Nothing recorded yet. Add what you book as you book it, and the ribbon above fills in.",
    // The running total: "~¥48,200 at rates from 10 Oct, plus GBP 120 with no rate on record".
    total: {
      jpy: (amount: string, estimate: boolean) => `${estimate ? "~" : ""}¥${amount}`,
      ratesFrom: (day: string) => ` at rates from ${day}`,
      noRate: (currency: string, amount: string, first: boolean) => `${first ? "" : "plus "}${currency} ${amount} with no rate on record`,
      join: ", ",
    },
    ribbon: {
      noDates: "No dates on this trip yet, so there are no nights to cover. Tell Bento Man when you are going.",
      heading: (from: string, to: string) => `Where you sleep · ${from}–${to}`,
      covered: (covered: number, total: number) => `${covered} of ${total} nights covered`,
      night: (date: string, booking: string) => `${date}: ${booking}`,
      nothingBooked: (date: string) => `${date}: nothing booked`,
      noCity: "No city yet",
    },
    severity: {
      blocking: "Blocking",
      closing: "Closing",
      worth_knowing: "Worth knowing",
    },
    today: "today",
    daysLeft: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
    dismiss: "Not a problem",
    dismissed: (n: number) => `${n} you said ${n === 1 ? "was" : "were"} not a problem`,
    restore: "Bring it back",
    form: {
      open: "Add a booking",
      title: "Add a booking",
      close: "Close",
      paste: "Paste the confirmation",
      pastePlaceholder: "Paste the whole email. It fills the form in below; nothing is saved until you press Save.",
      read: "Read it",
      reading: "Reading…",
      readNote: "Read in a separate call with no access to your trip. Booking references, email addresses and phone numbers are taken out before it's sent. Check every field before saving.",
      readFailed: "Couldn't read that.",
      kind: "What is it",
      kinds: {
        accommodation: { label: "Somewhere to sleep", hint: "Hotel, ryokan, hostel, apartment" },
        flight: { label: "Flight", hint: "Getting in and out of Japan" },
        transport: { label: "Between cities", hint: "Shinkansen, bus, ferry" },
        activity: { label: "Ticket", hint: "Timed entry, tour, museum" },
        restaurant: { label: "Table", hint: "A reservation" },
        other: { label: "Other", hint: "Anything else" },
      },
      name: "Name it",
      namePlaceholder: "Hotel Kanra Kyoto",
      provider: "Who with",
      providerPlaceholder: "Booking.com, ANA, JR West",
      checkIn: "Check in",
      checkOut: "Check out",
      starts: "Starts",
      ends: "Ends",
      timeLabel: (label: string) => `${label} time (optional)`,
      noTime: "No time — it shows as the date alone. Add one if you know it.",
      noTimeFromPaste: "The confirmation gave no time. Add one if you know it.",
      from: "From",
      where: "Where",
      noCity: "Not tied to a city",
      to: "To",
      reference: "Booking reference",
      referencePlaceholder: "ABC123",
      referenceNote: "Encrypted before it is stored. Never logged, never sent to Bento Man.",
      cost: "Cost",
      currency: "Currency",
      currencyPlaceholder: "JPY",
      notes: "Anything else",
      notesPlaceholder: "Non-refundable after 14 Nov",
      save: "Save it",
    },
    errors: {
      badDate: (which: "start" | "end") => `That ${which} date does not look right. Use the date picker.`,
      noTitle: "Give the booking a name.",
      tooLong: "That's too long. Shorten it and try again.",
      endsBeforeStarts: "That booking ends before it starts.",
      savedWithoutReference: "Saved, but not the reference: references can’t be stored right now, and a reference is never stored unencrypted.",
      doingSave: "save the booking",
      doingDelete: "delete the booking",
      doingList: "update the list",
    },
  },

  // Sentences the planner builds: why a stop was chosen, what was left out,
  // what doesn't fit. Bento Man reads these too, so they stay factual.
  plan: {
    weekdays: {
      0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
    },
    ordinals: { 1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth" },
    ordinal: (n: number) => `${n}th`,
    seasons: { sakura: "cherry blossom", koyo: "autumn colour" },
    // What a traveller can say they like. The label also finishes "matches …" under a stop, in lower case.
    interests: {
      shrines: { label: "Shrines & temples", hint: "Fushimi Inari, Todai-ji, Koyasan" },
      history: { label: "History & castles", hint: "Himeji, Matsumoto, Hiroshima" },
      nature: { label: "Nature & landscape", hint: "Gardens, gorges, mountains" },
      food: { label: "Food & drink", hint: "Markets, izakaya, ramen, sake" },
      onsen: { label: "Onsen", hint: "Hot springs and ryokan" },
      art: { label: "Art & museums", hint: "Naoshima, teamLab, craft" },
      popculture: { label: "Anime & pop culture", hint: "Akihabara, Ghibli, game centres" },
      shopping: { label: "Shopping", hint: "Depachika, vintage, stationery" },
      nightlife: { label: "Nightlife", hint: "Bars, live houses, late izakaya" },
      offbeat: { label: "Off the beaten path", hint: "Places most visitors miss" },
    },
    // Joins the clauses below into one sentence: "Matches food; quiet if you're there early."
    clauseJoin: "; ",
    clauseEnd: ".",
    and: " and ",
    reasons: {
      matches: (interests: string) => `matches ${interests}`,
      signature: "the one first-timers regret missing",
      inSeason: (season: string) => `at its best now — ${season}`,
      hidden: "most visitors miss it",
      repeat: (nth: string, category: string) => `your ${nth} ${category} today`,
      quietEarly: "quiet if you're there early",
      busyEarly: "busy — go early",
      busyAllDay: "busy at any hour",
      effort: "more effort than you said you wanted",
      mightSkip: (why: string) => `you might skip it: ${why}`,
      pricey: (yen: string) => `pricey for your budget here (¥${yen})`,
      // Added by the scheduler.
      opensAt: (time: string) => `opens at ${time}`,
      opensAtWait: (time: string) => `opens at ${time}, so a short wait`,
      beforeCrowd: (time: string) => `starting ${time}, before it fills`,
      busiestHour: "the busiest hour of your day, and unavoidable — it's worth the crowd",
      afterCrowd: (time: string) => `after ${time}, when it empties out`,
    },
    // Why a place was left out of a day.
    leftOut: {
      notCovered: "I don't know this place well enough yet to plan around it",
      unchecked: "nobody has checked this record yet, so I won't plan on it",
      noDuration: "no verified duration on record",
      alreadyPlanned: "already in the trip on another day",
      excluded: (what: string) => `you said never: ${what}`,
      notSuitable: (need: string) => `marked as one to skip for ${need}`,
      closed: (weekday: string) => `closed on ${weekday}s`,
      closedDate: "closed on this date",
      needsTicket: (lead: number | null) => `needs a ticket booked${lead ? ` about ${lead} days ahead` : ""} — none recorded`,
      clash: (other: string) => `can't share a day with ${other} — they're at opposite ends of the city`,
      noTime: (visit: number, travel: number, left: number) => `needs ${visit} min plus ${travel} min travel; ${left} min left in the day`,
      far: (extra: number) => `far from the rest of the day (+${extra} min)`,
      lowScore: (score: string) => `scored ${score} — not enough to earn a slot`,
      further: (extra: number) => `further from the rest of the day (+${extra} min)`,
      slightlyLower: (why: string) => `scored a little lower: ${why}`,
      closesBefore: (closes: string, arrive: string, visit: number) => `closes at ${closes}; you'd arrive at ${arrive} and need ${visit} min`,
    },
    // Notes under a planned day.
    warnings: {
      pinnedAnyway: (name: string, why: string) => `${name} is pinned but ${why} — kept because you pinned it`,
      noTrainData: (min: number, from: string, to: string) => `About ${min} min — no train data between ${from} and ${to} yet`,
      noStation: (name: string, min: number) => `${name} has no station in Bento's train data yet — legs to it are estimated at ${min} min`,
      noRoute: (from: string, to: string, min: number) => `No route between ${from} and ${to} in Bento's train data yet — estimated at ${min} min`,
      pinnedMissing: (id: string) => `Pinned place ${id} is not in this city's list`,
      opensLate: (name: string, time: string, wait: number) => `${name} opens at ${time} — the day waits ${wait} min for it`,
      pinnedLate: (name: string, pinned: string, reached: string) => `${name} is pinned for ${pinned} but the day only reaches it by ${reached}`,
      hoursNotFitted: "Some places could not be fitted to their opening hours",
      unpriced: (n: number) => n === 1
        ? "One ride's fare isn't in Bento yet, so the day's cost leaves it out"
        : `${n} rides' fares aren't in Bento yet, so the day's cost leaves them out`,
      // After a traveller's own edit.
      noRouteAssumed: (from: string, to: string, min: number) => `No route on record from ${from} to ${to} — assumed ${min} min`,
      pinnedShort: (name: string, pinned: string, prevEnds: string, short: number) => `${name} is pinned at ${pinned} but the previous stop runs until ${prevEnds} — ${short} min short`,
      opensWait: (name: string, time: string, wait: number) => `${name} opens at ${time} — ${wait} min wait`,
      closesDuring: (name: string, closes: string, ends: string) => `${name} closes at ${closes}; this visit runs to ${ends}`,
      overDay: (over: string, hours: number) => `${over} over a ${hours}-hour day`,
    },
    // Routes between cities.
    route: {
      canPlan: {
        deep: "can build full days here",
        outline: "can suggest places here but won't claim a day is complete",
        stub: "doesn't know this place well enough yet to plan days here",
      },
      noLeg: (from: string, to: string) => `${from} → ${to} · not in Bento's train data yet`,
      tooManyCities: (cities: number, nights: number, perCity: string) => `${cities} cities in ${nights} nights is ${perCity} nights per city — every second day is a moving day`,
      movingShare: (pct: number) => `${pct}% of waking time spent moving`,
      shortStops: (perCity: string) => `${perCity} nights per city leaves one full day in the shorter stops`,
      notCovered: (city: string) => `Bento doesn't know ${city} well enough yet to plan days there`,
      unknownLegs: (n: number) => `${n} leg${n === 1 ? "" : "s"} not in Bento's train data yet, so the train time is incomplete`,
      nightsMismatch: (trip: number, route: number) => `the trip has ${trip} nights and this route uses ${route}`,
      hours: (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : `${min} min`),
      oneCity: (city: string, nights: number) => `${city}, ${nights} night${nights === 1 ? "" : "s"}, no city changes.`,
      oneCityUnnamed: "One city",
      arithmetic: (cities: number, nights: number, perCity: string, changes: number, changeHours: number, train: string, moving: string, pct: number) =>
        `${cities} cities in ${nights} nights is ${perCity} nights per city. ` +
        `${changes} city change${changes === 1 ? "" : "s"} at about ${changeHours} hours each (check out, station, check in) ` +
        `plus ${train} on trains is ${moving} moving — about ${pct}% of your waking time.`,
      // The proposal header: "Kyoto, 4 nights → Nara, day trip".
      summaryCity: (city: string, nights: number) => `${city}, ${nights} night${nights === 1 ? "" : "s"}`,
      summaryDayTrip: (city: string) => `${city}, day trip`,
      suggestions: {
        kyoto: "The reason most people come. Temples, gardens, and the two mornings that make the trip.",
        osaka: "Where the airport is, and the food. Two nights is enough; it is a base, not a sight.",
        nara: "A day trip from Kyoto: the deer and Todai-ji, back for dinner. Bento Man can give the train.",
        hiroshima: "The Peace Park in the morning, Miyajima in the afternoon. Worth the Shinkansen.",
        himeji: "On the line to Hiroshima. Get off, see the castle, get back on.",
        tooShort: "Too short to move. One city, done properly.",
        kyotoNara: "Kyoto with a day in Nara. Osaka is close enough for an evening if you want one.",
        osakaKyoto: "Land in Osaka, move to Kyoto. Nara as a day trip.",
        hiroshimaHistory: "Hiroshima earns its two nights for someone who likes history.",
        hiroshimaOptional: "Hiroshima is the one long move. Skip it and give Kyoto the nights if trains are not your thing.",
        full: "The full corridor. Himeji is a stop on the way to Hiroshima, not a night.",
      },
    },
    // A day proposal's one-line summary: "4 stops · 6h 20m active · ~¥2,400".
    day: {
      stops: (n: number) => `${n} stop${n === 1 ? "" : "s"}`,
      added: (n: number) => `${n} added`,
      removed: (n: number) => `${n} removed`,
      moved: (n: number) => `${n} moved`,
      noChange: "no change",
      summary: (changes: string, active: string, yen: string, estimate: boolean) => `${changes} · ${active} active · ${estimate ? "~" : ""}¥${yen}`,
      days: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
      join: " · ",
    },
    dates: {
      none: "no dates",
      unknown: "?",
      range: (from: string, to: string) => `${from} – ${to}`,
      rangeNights: (range: string, nights: number) => `${range} (${nights} night${nights === 1 ? "" : "s"})`,
      summary: (dates: string) => `Dates → ${dates}`,
      // Refusals when the dates change.
      endBeforeStart: "The end date is before the start date.",
      tooShort: (route: number, trip: number) => `Your route is ${route} nights, and those dates are only ${trip}. Shorten the route first, or pick dates with at least ${route} nights.`,
      daysOutside: (days: string) => `You have day plans that would fall outside the new dates (${days}). Clear those days first, or keep the trip longer.`,
      closedOn: (name: string, weekday: string, day: string) => `${name} is closed on ${weekday}s, and would land on ${day}`,
      closedDate: (name: string, day: string) => `${name} is closed on ${day}`,
      noTicket: (name: string, day: string) => `${name} needs a ticket, and none is recorded for ${day}`,
      breaks: (conflicts: string, more: number) => `Moving the dates would break your day plans: ${conflicts}${more ? `; and ${more} more` : ""}. Re-plan or clear those days first, then change the dates.`,
      conflictJoin: "; ",
      routeLonger: (route: number, trip: number) => `the route is ${route} nights and the trip is now ${trip}`,
      changedWhileOpen: "the trip dates changed while this was open. Ask again.",
    },
    // Trains and walks.
    transit: {
      yen: (amount: string, estimate: boolean) => `${estimate ? "~" : ""}¥${amount}`,
      walk: (from: string, to: string, min: number) => `Walk · ${from} → ${to} · ${min} min`,
      walkOnly: (min: number) => `Walk · ${min} min`,
      nonstop: "nonstop",
      stops: (n: number) => `${n} stops`,
      ride: (line: string, from: string, to: string, stops: string, min: number, fare: string, notes: string) =>
        `${line} · ${from} → ${to} · ${stops} · ${min} min${fare ? ` · ${fare}` : ""}${notes ? ` — ${notes}` : ""}`,
      noteJoin: "; ",
      duration: (h: number, m: number) => (h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`),
      faresMissing: (n: number) => `${n === 1 ? "a fare" : `${n} fares`} not in Bento yet`,
      farePlusMissing: (fare: string, missing: string) => `${fare} + ${missing}`,
      fareMissing: "fare not in Bento yet",
      free: "free",
      changes: (n: number) => (n === 0 ? "no changes" : n === 1 ? "1 change" : `${n} changes`),
      summary: (from: string, to: string, duration: string, fare: string, changes: string) => `${from} → ${to} · ${duration} · ${fare} · ${changes}`,
      door: (walkTo: number, station: string, legs: string, walkFrom: number) => `Walk ${walkTo} min to ${station}, ${legs}, walk ${walkFrom} min`,
      legJoin: ", then ",
    },
    // The vault's "what's missing" cards.
    gaps: {
      inCity: (city: string) => ` in ${city}`,
      runsThrough: (title: string, day: string) => `${title} runs through the ${day}`,
      startsOn: (title: string, day: string) => `${title} starts on the ${day}`,
      oneNight: (day: string) => `the night of ${day}`,
      nights: (n: number, from: string, to: string) => `${n} nights, ${from} to ${to}`,
      noBed: (span: string, where: string) => `You have nowhere to sleep on ${span}${where}.`,
      between: (parts: string) => `${parts}. Nothing covers the nights in between.`,
      betweenJoin: " and ",
      noBedInCity: (city: string, nights: number) => `Your route has you in ${city} ${nights === 1 ? "that night" : "those nights"}, and no accommodation is recorded.`,
      noBedNoCity: "No accommodation is recorded, and the route does not say where you are.",
      addBooking: "Add a booking",
      askBentoMan: "Ask Bento Man",
      askWhereToStay: (day: string) => `Where should we stay on ${day}?`,
      noMove: (from: string, to: string, day: string | null) => `Nothing booked for ${from} to ${to}${day ? ` on the ${day}` : ""}.`,
      noMoveDetail: "Most trains on this corridor take an IC card and no reservation, so this is usually fine to leave. Book it if you have a large case, or if it is a peak week.",
      askHowToGet: (from: string, to: string) => `How do we get from ${from} to ${to}?`,
      ticketNeeded: (name: string) => `${name} needs a ticket booked in advance, and none is recorded.`,
      ticketDetail: (day: string, lead: number | null, window: string | null) =>
        `It is on your ${day}.${lead ? ` These release about ${lead} days ahead${window ? `, and that window is ${window}` : ""}.` : ""} The planner will leave it out of the day until a booking exists.`,
      windowGone: "gone",
      windowClosing: (days: number) => `${days} days from closing`,
      askAboutTicket: (name: string) => `Tell me about booking ${name}.`,
      ticketSoon: (name: string) => `${name} is worth booking ahead, and the window is closing.`,
      ticketSoonDetail: (day: string, when: string, lead: number) => `It is on your ${day}, ${when}, and it usually wants about ${lead} days' notice. Walking up often works; it is not a certainty.`,
      today: "today",
      daysAway: (n: number) => `${n} day${n === 1 ? "" : "s"} away`,
      noFlights: "No flights recorded.",
      noFlightsDetail: "Bento does not book flights or fetch them from anywhere. Adding them here means the arrival day is planned around the time you actually land, rather than from midnight.",
    },
  },

  // Messages from the servers behind the chat and the confirmation reader.
  server: {
    signInFirst: "Sign in first.",
    bodyTooLarge: "That's too much text to send at once.",
    chatEmpty: "Say something, up to 2000 characters.",
    slowDown: "Slow down a little — try again in a moment.",
    chatOff: "Bento Man isn't available on this site yet.",
    tooSlow: "Bento Man took too long to answer. Try again, or ask for a smaller step.",
    keyRejected: "Bento Man can't sign in to its model right now. Try again later.",
    outOfRequests: "Bento Man has used up its requests for now. Try again later.",
    overloaded: "Bento Man's model is overloaded right now. Try again in a minute.",
    busy: "Bento Man is busy — try again in a minute.",
    failedWith: (status: number) => `Bento Man hit an error (${status}). Try again.`,
    notYourTrip: "That trip isn't yours, or doesn't exist.",
    failed: "Something went wrong on the way to Bento Man. Try again.",
    capUser: (spent: string, cap: string) => `Monthly spend cap reached: $${spent} of $${cap}. Planning still works — only Bento Man is paused.`,
    capGlobal: "Bento Man is resting for the rest of the month — the shared budget is used up. Planning still works.",
    pasteFirst: "Paste the confirmation text first.",
    tooManyPastes: "That's a lot of confirmations at once. Try again in a moment.",
    readerOff: "Reading confirmations isn't available on this site. Fill the form in by hand.",
    readFailed: "Couldn't read that one. Fill the form in by hand.",
    readError: "Something went wrong reading that. Fill the form in by hand.",
    readTooShort: "There is not enough here to read.",
    readRefused: "That text could not be read.",
    readEmpty: "Nothing came back. Enter the booking by hand.",
    readNotBooking: "That did not come back as a booking. Enter it by hand.",
    readNotBookingShape: "That did not look like a booking. Enter it by hand.",
    fromTo: "Pick where you're starting and where you're going.",
    noRoute: (from: string, to: string) => `No route from ${from} to ${to}.`,
  },

  settings: {
    title: "Settings",
    // The main page is a short list: each row says what's set now and opens
    // its group's own page.
    rows: {
      personal: "Personal information",
      appearance: "Appearance",
      privacy: "Privacy & data",
      admin: "Admin",
      adminSummary: "Curation, review queue, AI spend and admins",
      tourSummary: "See the short walkthrough again, from your trips.",
    },
    summary: {
      personal: (name: string, email: string) => (name ? `${name} · ${email}` : email),
      appearance: (theme: string, background: string) => `${theme} theme · ${background} background`,
      // Analytics is mentioned only where it can run (null: no key).
      privacy: (analytics: boolean | null) =>
        analytics === null ? "Your data, Bento's terms, delete account" : `Usage analytics ${analytics ? "on" : "off"} · your data · delete account`,
    },
    passwordChanged: "Your password was changed.",
    personal: {
      title: "Personal information",
      email: "Email",
      viaGoogle: "You sign in with Google.",
      viaPassword: "You sign in with this email and a password.",
    },
    name: {
      heading: "Your name",
      body: "What Bento calls you when you come back. Optional, and never sent to Bento Man or analytics. Leave it empty for none.",
      label: "Name",
      save: "Save name",
      saved: "Saved.",
      failed: "Your name wasn't saved. Try again in a moment.",
    },
    appearance: { title: "Appearance" },
    privacy: { title: "Privacy & data" },
    // Only admin accounts see this page, or its row on the list.
    admin: {
      heading: "Admin",
      body: "Only admin accounts see this page.",
      tools: {
        heading: "Tools",
        curation: "Curation: cities and coverage",
        review: (n: number) => (n > 0 ? `Review queue · ${n} to check` : "Review queue · nothing to check"),
        bulk: "Verify several at once",
        tripReviews: (n: number) => `Trip reviews · ${n}`,
        // When a count couldn't be read just now: the link without it.
        reviewPlain: "Review queue",
        tripReviewsPlain: "Trip reviews",
      },
      spend: {
        heading: "This month",
        // Dollar amounts arrive written out, e.g. "0.07".
        spent: (spent: string, cap: string) => `AI spend so far: $${spent} of the $${cap} monthly limit for everyone.`,
        unavailable: (cap: string) => `This month's AI spend couldn't be read just now. The monthly limit for everyone is $${cap}; reload to try again.`,
        perUser: (cap: string) => `Each traveller can spend up to $${cap} a month.`,
        model: (provider: string, model: string) => `Bento Man runs on ${provider}, model ${model}.`,
        fallbacks: (models: string) => `If it's busy or out of quota: ${models}.`,
        changeNote: "These are set in Vercel's environment variables; a change there needs a new deploy.",
        providers: { gemini: "Google Gemini", anthropic: "Anthropic Claude" },
      },
      admins: {
        heading: "Admins",
        you: "you",
        since: (date: string) => `since ${date}`,
        remove: "Remove",
        removeLabel: (email: string) => `Remove admin access for ${email}`,
        removeConfirm: (email: string) => `Remove admin access for ${email}? They keep their account and trips.`,
        addLabel: "Give someone admin access",
        addHint: "They need a Bento account first. Admins can verify places, change how well a city is covered and read trip reviews.",
        add: "Make admin",
        addConfirm: "Give this account admin access? It will be able to verify places, change city coverage and read trip reviews.",
        added: "Admin access given.",
        removed: "Admin access removed.",
        errors: {
          badEmail: "That doesn't look like an email address.",
          noAccount: "No Bento account uses that address. Ask them to sign up first.",
          already: "That account is already an admin.",
          self: "You can't remove your own admin access. Ask another admin.",
          last: "Bento needs at least one admin.",
          failed: "That didn't save. Try again in a moment.",
        },
      },
    },
    password: {
      heading: "Password",
      google: "You sign in with Google, so there’s no Bento password to change.",
      body: "Change the password you sign in with.",
      change: "Change password",
    },
    theme: {
      heading: "Theme",
      body: "System follows your device. The choice is kept on this device.",
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    background: {
      heading: "Background",
      body: "The scene behind every page. Automatic follows today’s date, and a trip’s own dates on its page. Kept on this device.",
      auto: "Automatic",
      spring: "Spring",
      summer: "Summer",
      autumn: "Autumn",
      winter: "Winter",
    },
    tour: {
      heading: "Tour",
      body: "The short walkthrough of your trips, a trip and its vault. It starts again on the trips list, then on each page as you open it.",
      replay: "Show the tour again",
      pending: "Opening…",
    },
    analytics: {
      heading: "Usage analytics",
      body: "Records which features you use and when something breaks, so we can fix it. Never what you type, your bookings or your email.",
      on: "On",
      off: "Off",
      more: "How Bento uses data",
    },
    deleteAccount: {
      heading: "Delete account",
      // Its row on Privacy & data, which opens the page with the form.
      summary: "Removes your account and everything in it.",
      body:"Deletes your account and everything in it: trips, day plans, bookings and your conversations with Bento Man. This can't be undone.",
      password: "Your password, to confirm",
      email: "Type your email address to confirm",
      submit: "Delete my account",
      pending: "Deleting…",
      confirm: "Delete your account and everything in it? This can't be undone.",
      admin: "This account has admin access. Ask another admin to remove it in their Settings first, so nobody is locked out of curation.",
      emailMismatch: "That isn't the email address this account uses.",
      failed: `Your account wasn't deleted. Try again, or write to ${CONTACT}.`,
      done: "Your account and everything in it has been deleted.",
      // PostHog couldn't be reached after three tries. What is done comes first.
      doneAnalyticsPending: `Your account and everything in it has been deleted. Your usage analytics couldn't be deleted just now; they will be deleted by hand. Write to ${CONTACT} if you'd like to know when.`,
    },
    legal: {
      heading: "Your data and Bento's terms",
      body: "What Bento keeps and why, the terms you agreed to, the cookies it uses, and who runs it.",
    },
  },

  // The consent banner. Shown once, until you choose.
  consent: {
    label: "Analytics choice",
    body: "Can Bento record how you use it — which buttons, which pages, and when something breaks? Never what you type, your bookings or your email. It helps us fix problems.",
    accept: "Allow",
    decline: "No thanks",
    more: "Details",
  },

  // Shared by the legal pages: the links between them (also in the home
  // footer and Settings) and the contact line at the end of each.
  legal: {
    navLabel: "About Bento and your data",
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
    about: "Who runs Bento",
    contactLabel: "Questions or requests:",
    contact: CONTACT,
  },

  privacy: {
    title: "How Bento uses data",
    updated: "Last updated 20 October 2026",
    intro: "Bento is a trip planner. This page says what it keeps about you, who else handles it, and what you can do about it. In short: your plan stays yours, booking references are encrypted, and usage analytics only run if you say yes.",
    // Links shown under a section, by the section's key.
    links: {
      operator: "Business details",
      cookies: "Every cookie, and your analytics answer",
    },
    // Each section: a heading and its text, in order. A blank line (\n\n) starts a new paragraph.
    sections: {
      operator: {
        heading: "Who is responsible",
        body: `Bento is run by ${OPERATOR}, an individual based in Japan, who is responsible for your data under Japan's Act on the Protection of Personal Information and, for visitors in the EU and UK, the GDPR.\n\nThe operator's full name and postal address are given without delay to anyone who asks. Write to ${CONTACT}.`,
      },
      account: {
        heading: "Your account",
        body: "Your email address and password (stored hashed by our sign-in provider), to sign you in.\n\nYour name, if you give one, only to greet you. It isn't sent to Bento Man or analytics, and you can change or remove it in Settings.\n\nYour date of birth is asked once at sign-up to check you are old enough, and is not kept. Only whether you passed is remembered, in a cookie.",
      },
      plan: {
        heading: "Your trips",
        body: "Trip names, dates, the number of people travelling, your route, your day plans and what you tell Bento Man about your preferences.\n\nBookings you add: names, dates, providers, costs and notes. Booking reference numbers are encrypted before they are stored and are never sent to Bento Man or to analytics.\n\nAfter a trip ends you can tell us how the plan held up. That answer is kept with the trip and read by the people who build Bento, to improve the planner.\n\nIf you share a trip with your companions, anyone with its link can see the route, the day plans and your bookings' names and times (never reference numbers) until you switch the link off. Pages opened with a shared link don't run analytics.",
      },
      bentoMan: {
        heading: "Bento Man and the confirmation reader",
        // `chat` is the provider this deployment uses for Bento Man (BENTO_MAN_PROVIDER).
        body: (chat: "gemini" | "anthropic") => (chat === "gemini"
          ? "What you write to Bento Man is sent to an AI model provider to produce the reply, together with your trip's dates, route and plan. Today that provider is Google (Gemini). On the plan Bento currently uses, Google may use this text to improve its products, so don't write anything to Bento Man you wouldn't want stored by Google."
          : "What you write to Bento Man is sent to an AI model provider to produce the reply, together with your trip's dates, route and plan. Today that provider is Anthropic (Claude), which does not use it to train its models.") +
          "\n\nWhen you paste a confirmation email into the booking form, Bento first takes out the booking references, email addresses, phone numbers and long card or ticket numbers it recognises, and fills the reference in for you itself. The rest of the text, including names, goes to Anthropic (Claude) only to fill in the form. Nothing is saved until you press Save. Booking references are never sent to Bento Man.",
      },
      analytics: {
        heading: "Usage analytics (only if you say yes)",
        body: "If you allow it, Bento records which pages you open (the page, not what's in its address), which buttons you press, how long Bento Man takes to answer, whether you accept its plans, and errors. This uses PostHog, with data stored in the EU.\n\nIt is linked to an internal account number, never your email or name. PostHog receives your device's IP address, as any website does, and Bento tells it not to work out your location from it. Screen recordings used to find problems blank out all text and every field, so what you type and your bookings are never recorded.\n\nYou can turn it off any time in Settings or on the cookies page. Saying no changes nothing else about Bento.",
      },
      purposes: {
        heading: "Why Bento uses it",
        body: "Your account and your plans: to give you the service you signed up for.\n\nKeeping Bento secure, within its spending limit, and fixing what breaks: Bento's legitimate interest in keeping it working for everyone.\n\nUsage analytics: only with your consent, which you can withdraw at any time.\n\nBento doesn't sell your data, doesn't use it for advertising, and doesn't use it to make decisions about you that have legal or similarly serious effects.",
      },
      emails: {
        heading: "Emails",
        body: "Bento only emails you about your account: a link to confirm your address when you sign up, and a link to reset your password when you ask for one. They come with having an account, so they have no unsubscribe link.\n\nBento sends no newsletters or marketing. If that ever changes, it will only be with your yes, and every such email will have a link that stops them in one click.",
      },
      cookies: {
        heading: "Cookies",
        body: "Bento uses cookies to keep you signed in and to remember your choices: theme, background, the tour, the age check and your analytics answer. These are needed for the site to work.\n\nPostHog sets its own cookie and local storage only after you allow analytics. The cookies page lists each one, what it's for and how long it lasts.",
      },
      who: {
        heading: "Who else handles your data",
        // `googleSignIn`: whether "Continue with Google" is switched on (BENTO_GOOGLE_SIGN_IN).
        body: (chat: "gemini" | "anthropic", googleSignIn: boolean) =>
          (chat === "gemini"
            ? "Supabase (database and sign-in), Vercel (hosting), Google (Bento Man), Anthropic (reading pasted confirmations) and, only with your consent, PostHog (analytics, EU)."
            : "Supabase (database and sign-in), Vercel (hosting), Anthropic (Bento Man and reading pasted confirmations) and, only with your consent, PostHog (analytics, EU).") +
          (googleSignIn ? " If you continue with Google, Google also confirms who you are and shares your email address and name with Bento." : "") +
          (chat === "gemini"
            ? " Apart from Google's use of Bento Man messages described above, each handles data only to provide its service to Bento."
            : " Each handles data only to provide its service to Bento."),
      },
      maps: {
        heading: "Map and directions links",
        body: "Map and Directions links open Google Maps in a new tab, with the place's name and city, or the locations of the two stations, in the link. Bento sends Google nothing until you open one. What you do in Google Maps is then handled by Google under its own privacy policy.",
      },
      where: {
        heading: "Where it's handled",
        body: (chat: "gemini" | "anthropic") =>
          "Your account and trips are stored in India (Mumbai), where Bento's servers also run. " +
          (chat === "gemini"
            ? "Bento Man's replies are made by Google, and pasted confirmations are read by Anthropic, mainly in the United States."
            : "Bento Man's replies and the reading of pasted confirmations are made by Anthropic, mainly in the United States.") +
          " Usage analytics, if you allow them, are stored in the EU (Germany).\n\nPrivacy law differs between these places: India has its Digital Personal Data Protection Act, the EU has the GDPR, and the United States has no single national privacy law. Each company works under its terms with Bento, which limit what it may do with your data. Ask us if you'd like more detail about any of them.",
      },
      protect: {
        heading: "How it's protected",
        body: "Connections to Bento are encrypted. Booking reference numbers are encrypted again before they are stored, with a key kept apart from the database.\n\nA trip can only be read by its owner, which the database itself enforces, and by people the owner gives a shared link to. Only the operator can reach the systems behind Bento. Admins the operator appoints to check place information can read trip reviews and the plans saved with them, but never travellers' names or email addresses. The only email addresses an admin sees are those of the other admins, in the list of who has admin access.",
      },
      keep: {
        heading: "How long it's kept",
        body: "Your account and trips are kept until you delete them. A shared link works until you switch it off or delete the trip. Analytics events are kept for up to one year.",
      },
      children: {
        heading: "Children",
        body: `Bento is for people aged ${MIN_AGE} and over. Sign-up asks for your date of birth and won't go on if it is under ${MIN_AGE}; by creating an account you confirm the date you gave is yours. Bento doesn't check it further and doesn't knowingly keep data about children under ${MIN_AGE}. If you think a child has an account, write to us and we'll delete it.`,
      },
      rights: {
        heading: "Your rights",
        // `analyticsDeletion`: whether deleting an account also deletes its analytics in PostHog here.
        body: (chat: "gemini" | "anthropic", googleSignIn: boolean, analyticsDeletion: boolean) =>
          "You can delete a trip from your trips list, or your whole account in Settings, at any time. Deleting your account removes your trips, day plans, bookings, shared links, conversations with Bento Man, trip reviews and preferences straight away. " +
          (analyticsDeletion
            ? "Analytics linked to your account are deleted from PostHog at the same time. If PostHog can't be reached, you're told so when your account is deleted, and they are deleted by hand. "
            : "To have analytics linked to your account deleted too, write to the address below. ") +
          "Records of what Bento's AI calls cost (Bento Man and the confirmation reader) are kept without any link to you, because they enforce the spending limit.\n\nIf you can't sign in, write to us from the email address on the account and we will delete it within 30 days.\n\nYou can also ask for a copy of your data, ask us to correct it or stop using it, or withdraw consent for analytics at any time. Write to the address below and we will answer within 30 days.\n\nIf you're unhappy with how Bento handles your data, please tell us first. You can also complain to Japan's Personal Information Protection Commission, or to the data protection authority where you live.",
      },
    },
  },

  terms: {
    title: "Terms of use",
    updated: "Last updated 20 October 2026",
    intro: "The agreement between you and Bento when you use it. It's written to be read: if anything here is unclear, write to us and we'll explain.",
    sections: {
      service: {
        heading: "What Bento is",
        body: `Bento is a trip planner for Japan, run by ${OPERATOR}. It helps you plan a route and your days, and keeps the bookings you add in one place.\n\nBento doesn't sell or book travel and isn't a travel agency. When you book a hotel, a flight, a train or a ticket, your agreement is with that provider, not with Bento.`,
      },
      refunds: {
        heading: "Price and refunds",
        body: "Bento is free. There are no fees, subscriptions or charges, so there is nothing to refund.\n\nBookings you make elsewhere follow that provider's own cancellation and refund rules. Adding one to Bento doesn't change them, and Bento can't cancel or refund it for you.\n\nIf Bento ever offers something paid, its price, what it includes and its refund rules will be shown before you pay, and nothing will be charged without your clear yes.",
      },
      account: {
        heading: "Your account",
        body: `You need to be ${MIN_AGE} or older to create an account, and by creating one you confirm that you are. If you're under 18, check that a parent or guardian is happy for you to use Bento.\n\nAn account is for one person. Keep your password to yourself: you're responsible for what's done with your account. If you think someone else has used it, change your password and write to us.`,
      },
      yours: {
        heading: "Your plans stay yours",
        body: "Trips, notes and bookings you add belong to you. You allow Bento to store them and use them to run the service for you: for example, to send your trip to Bento Man when you ask it something, or to show a shared plan to the people you give its link to. The privacy page sets out how.\n\nYou can delete a trip, or your whole account, at any time.",
      },
      bentoMan: {
        heading: "Bento Man's suggestions",
        body: "Times, trains and opening hours in your plan come from Bento's place and train information, and Bento Man works from them. Bento Man can still word something wrongly, and places change their hours or close for a holiday, so for anything you can't miss, such as a last train or a timed ticket, a quick look at the official source before you set off is worth it.\n\nNothing changes in your plan until you accept it. What you do on your trip is your decision.",
      },
      sharing: {
        heading: "Shared plans",
        body: "When you share a trip, anyone with its link can see the plan. Share it only with people you want to see it. You can make a new link or switch sharing off at any time.",
      },
      use: {
        heading: "Using Bento fairly",
        body: "Please don't use Bento to break the law; try to get into other people's accounts or trips; try to break, overload or get round Bento's security or limits; copy Bento's place and train information in bulk, by script or otherwise; or get Bento Man to write things that are hateful, harassing or meant to harm.\n\nIf an account is used like this, we may suspend or close it. Unless the law or someone's safety stops us, we'll tell you why and give you a chance to explain.",
      },
      changes: {
        heading: "When Bento or these terms change",
        body: "Bento is new and will change: features may be added, changed or removed. If Bento is ever going to close, the site will say so at least 30 days before, so you can save your plans (Download plan keeps a copy).\n\nIf these terms change in a way that matters, the new version will be published here, with the date it applies from, at least 14 days before. If you keep using Bento after that date, the new terms apply; if you don't agree with them, you can delete your account.",
      },
      responsibility: {
        heading: "Responsibility",
        body: "Bento is provided as it is. We work to keep it accurate and running, but can't promise it will always be available or free of mistakes.\n\nWe're fully responsible for harm we cause on purpose or through gross negligence. For a loss caused by ordinary carelessness on our part, we're responsible only for the direct loss that could normally be expected. Nothing in these terms takes away rights you have under the consumer law where you live.",
      },
      law: {
        heading: "Law",
        body: "These terms are governed by the law of Japan. If there's a problem, please write to us first: most things can be sorted out that way. If it can't be, it goes to a court in Japan that has jurisdiction, unless the law where you live gives you the right to use your own courts.",
      },
    },
  },

  cookies: {
    title: "Cookies",
    updated: "Last updated 18 October 2026",
    intro: "Cookies are small files a site keeps in your browser. Bento uses a few, to keep you signed in and to remember your choices. They stay on this device and are never used for advertising.",
    purpose: "What it's for",
    lasts: "How long",
    needed: {
      heading: "Needed for Bento to work",
      body: "Set when you use the part of Bento they belong to. They can't be switched off here, because Bento wouldn't work without them, but you can delete them in your browser.",
      // Each row: the cookie's name, what it's for and how long it lasts. In this order.
      rows: {
        session: { name: "sb-…-auth-token", purpose: "Keeps you signed in. Removed when you sign out.", lasts: "Up to 400 days" },
        emailLink: { name: "sb-…-code-verifier", purpose: "Finishes signing you in from a link we email you, in the browser that asked for it.", lasts: "Until you use the link" },
        reset: { name: "bento_pw_reset", purpose: "Lets you choose a new password after opening a reset link.", lasts: "15 minutes" },
        ageOk: { name: "bento_age_ok", purpose: "Remembers that you passed the age check at sign-up, so it's asked once. Your date of birth is never kept.", lasts: "1 year" },
        ageBlocked: { name: "bento_age_blocked", purpose: "Remembers that the age check didn't pass, so it can't simply be retried with another date.", lasts: "Until the birthday that makes you old enough" },
        analytics: { name: "bento_analytics", purpose: "Your answer about usage analytics, yes or no.", lasts: "1 year, then Bento asks again" },
        theme: { name: "bento_theme", purpose: "The theme you chose in Settings.", lasts: "1 year" },
        season: { name: "bento_season", purpose: "The background you chose in Settings.", lasts: "1 year" },
        tour: { name: "bento_tour", purpose: "Which parts of the tour you've seen, so it doesn't start again.", lasts: "1 year" },
      },
    },
    analytics: {
      heading: "Usage analytics (only if you say yes)",
      body: "Set only after you allow usage analytics, and removed from this browser when you say no.",
      rows: {
        posthog: { name: "ph_… and __ph_…", purpose: "PostHog's random ID for this browser, linked to your account's internal number when you're signed in (never your email), and its note that you said yes. Kept in a cookie and in local storage.", lasts: "1 year" },
      },
    },
    choice: {
      heading: "Your analytics answer",
      body: "Change it here at any time, signed in or not. Saying no changes nothing else about Bento.",
      none: "You haven't answered yet, so nothing is recorded.",
      yes: "You've allowed usage analytics.",
      no: "You've said no to usage analytics.",
      off: "This copy of Bento doesn't run usage analytics, so there's nothing to choose.",
    },
    browser: {
      heading: "In your browser",
      body: "You can also delete or block cookies in your browser's settings. If you block the ones Bento needs, you won't be able to sign in.",
    },
  },

  about: {
    title: "Who runs Bento",
    updated: "Last updated 18 October 2026",
    intro: "Bento is a small, independent trip planner for first trips to Japan.",
    details: {
      heading: "Business details",
      // Each row: a label and its value, in this order.
      rows: {
        operator: { label: "Run by", value: `${OPERATOR}, an individual based in Japan` },
        contact: { label: "Contact", value: CONTACT },
        address: { label: "Full name and address", value: "Given without delay to anyone who asks: write to the address above." },
        price: { label: "Price", value: "Free. No fees, subscriptions or paid features." },
        bookings: { label: "Bookings", value: "Bento doesn't sell or book travel and isn't a travel agency." },
      },
    },
    commerce: {
      heading: "特定商取引法に基づく表記",
      headingMeaning: "Notice under Japan's Act on Specified Commercial Transactions",
      body: "Bento sells nothing, so this notice isn't required. It will be published here in full before anything is offered for sale.",
    },
    credits: {
      heading: "Fonts and images",
      body: "Text is set in Zen Maru Gothic (© The Zen Maru Gothic Authors), Zen Kaku Gothic New (© The Zen Project Authors) and DM Mono (© The DM Mono Project Authors). The Bento wordmark is drawn from Bricolage Grotesque (© The Bricolage Grotesque Project Authors). All four are used under the SIL Open Font License 1.1. The fonts are served by Bento itself, so no font service sees your visit.\n\nThe logo, icons, Bento Man and the seasonal illustrations were made for Bento. Bento uses no stock photos or other people's images.",
      licence: "Read the SIL Open Font License",
    },
  },

  tour: {
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    skip: "Skip",
    back: "Back",
    next: "Next",
    done: "Done",
    trips: {
      welcome: {
        title: "Welcome to Bento",
        body: "A one-minute tour: where trips live, how Bento Man works, and what each page is for. It changes nothing, and you can replay it any time from Settings.",
      },
      newTrip: {
        title: "Start a trip here",
        body: "Plan a Japan trip asks roughly when, who, your pace and what you like, then hands over to Bento Man. Or start a blank trip below with a name and dates. All of it can change later.",
      },
      open: {
        title: "Then open it",
        body: "Every trip has a plan, a chat with Bento Man, and a vault for your bookings.",
      },
    },
    trip: {
      chat: {
        title: "Bento Man",
        body: "Tell it the dates, what you like and what you would never do. It proposes a route and days — and nothing changes until you press Accept.",
      },
      edit: {
        title: "Dates and party",
        body: "Add or change dates here. Planned days move with them, and a change that would break a plan is refused, with the reason.",
      },
      dayBox: {
        title: "Each day is a box",
        body: "Stops are sized to the time they take. Drag to reorder, pin a stop to keep it, or re-plan the day around your pins. Drag a booking in from the Bookings column — only to its own date.",
      },
      vault: {
        title: "The vault",
        body: "Add flights, hotels and tickets. Bento tells you what is missing — a night with no bed, a ticket you still need. Booking references are encrypted.",
      },
      end: {
        title: "That’s the tour",
        body: "Replay it any time from Settings, at the top of the page.",
      },
    },
    vault: {
      missing: {
        title: "What’s missing, in plain words",
        body: "The cards at the top say what your trip still needs: a bed for a night, a ticket for a place that requires one. Each has a button to fix it.",
      },
      add: {
        title: "Add a booking",
        body: "Type it in, or paste a confirmation and Bento fills the form for you. You check every field before it is saved.",
      },
    },
  },
};

/** The shape every language follows. A new language is a file that
 *  satisfies this type, so a missing line fails the build. */
export type Copy = typeof en;
