/** Every word the app shows, in English. Change a line here and the page
 *  changes with it. Grouped by screen; a sentence with something filled in
 *  (a name, a date) is a small function, so the whole sentence — word order
 *  included — stays here.
 *
 *  Voice (DESIGN.md): plain sentences, no cheerleading, no internal words.
 *  `copy.test.ts` checks every line is filled in and free of jargon. */
export const en = {
  meta: {
    title: "Bento — plan Japan properly",
    description:
      "A trip planner for people who have never been to Japan. Real travel times, honest expectations, and a plan that tells you what's still missing.",
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
        bookings: { title: "Bookings in one place", body: "Confirmation numbers are encrypted, and only you can see them." },
      },
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
        route: { title: "Get a route that adds up", body: "Cities and nights with the train time shown. Over-packed plans are refused, with the arithmetic." },
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
    startPlanning: "Start planning",
    hero: {
      kicker: "For your first trip to Japan",
      kickerJa: "弁当",
      title: "Plan Japan like you’ve been before.",
      body: "Bento is a trip planner that tells you the honest version — how long each place really takes, which trains to catch, and what’s still missing from your plan — the way a friend who lives there would.",
      note: "Bento suggests; you decide. Nothing changes in your plan until you say yes.",
    },
    how: {
      eyebrow: "How it works",
      title: "Three steps, one box",
      steps: [
        { title: "Tell Bento Man the trip", body: "Your dates, who’s going, what you love and what you’d never do. A few questions in a chat, not a long form." },
        { title: "Get a route that adds up", body: "Cities and nights in order, with the train time between them. If it’s too much, it says so — with the arithmetic." },
        { title: "Open each day like a box", body: "Every stop sized to the time it takes, the train written between them. Pin, reorder, or ask for a re-plan." },
      ],
    },
    different: {
      eyebrow: "What it does differently",
      title: "Honest, not exhaustive",
      durations: { title: "Real durations, not listings", body: "Fushimi Inari is 45 minutes to the gates and three hours to the summit. Which one you have time for changes the day." },
      honest: { title: "It admits what it doesn’t know", body: "Every city says how well it’s covered. A thin guess dressed up as a plan is the one thing this won’t do." },
      gaps: { title: "It finds the gaps", body: "The night you have no hotel, the leg with no train, the ticket whose booking window closes next week." },
    },
    coverage: {
      eyebrow: "Where it knows best today",
      title: "The Kansai–Sanyo corridor",
      body: "The trains between these cities, with real times and fares, and place-by-place detail for the cities most first trips are built on. The rest of Japan is on the map too — and each city tells you how much Bento really knows about it.",
      cities: [["Kyoto", "京都"], ["Osaka", "大阪"], ["Nara", "奈良"], ["Himeji", "姫路"], ["Hiroshima", "広島"], ["Miyajima", "宮島"]] as [string, string][],
    },
    closing: {
      title: "Your first trip, without the guesswork.",
      body: "Start with your dates. Bento Man takes it from there.",
    },
    footer: "Bento — Japan, planned properly",
    footerJa: "いってらっしゃい",
    // The sample day beside the headline: an illustration, not real data.
    preview: {
      caption: "An example day in Kyoto, planned by Bento: four stops from 7:30, with the reason for each.",
      date: "Sunday 22 November",
      summary: "Kyoto · 6h 40m",
      stops: [
        { time: "07:30", name: "Fushimi Inari Taisha", why: "Before the tour groups — the lower gates are quiet until about 8." },
        { time: "10:20", name: "Tofuku-ji", why: "Two stops south. The bridge view is the point." },
        { time: "12:30", name: "Lunch near Kyoto Station" },
        { time: "14:00", name: "Sanjusangen-do", why: "1,001 statues in one hall. Shoes off; allow an hour." },
      ],
      bentoMan: "Arashiyama is the other side of the city — fifty minutes each way. I’ve left it for Tuesday, when you’re already west.",
    },
  },

  trips: {
    title: "Your trips",
    signedInAs: "Signed in as",
    untitled: "Untitled trip",
    noDates: "No dates yet",
    nights: (n: number) => `${n} night${n === 1 ? "" : "s"}`,
    people: (n: number) => `${n} people`,
    delete: "Delete",
    deleteLabel: (title: string) => `Delete ${title}`,
    deleteConfirm: (title: string) => `Delete “${title}”? Its route, days, chat and bookings go with it. This can’t be undone.`,
    empty: "No trips yet. Start one below — dates can come later.",
    new: {
      title: "Start a trip",
      body: "Everything here is optional and can be changed later — you can also just tell Bento Man.",
      name: "Name it",
      namePlaceholder: "Kansai, autumn",
      arrive: "Arrive in Japan",
      leave: "Leave Japan",
      people: "People travelling",
      submit: "Create trip",
      pending: "Creating…",
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
  },

  settings: {
    title: "Settings",
    passwordChanged: "Your password was changed.",
    account: "Account",
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
        body: "Give it a name, dates and who is going. All of it is optional and can change later — or just tell Bento Man.",
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
