---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# The mobile path

**Not started.** This keeps iOS and Android apps possible, at no cost today, as long as one discipline holds: **all logic lives in `bento/src/lib/` as pure functions and behind server routes, never in React components.** Supabase's sign-in works in React Native, so sessions would carry over.

Planned order, when the time comes:
1. A progressive web app. It's free, and the ticket-gate case (one bar of signal, today's plan needed) is the one that matters.
2. Capacitor, for a store listing in a week or two.
3. Expo, only if there's enough use to justify a separate interface.

Notes:
- An offline "today" view isn't built yet ([open questions](../00-start/open-questions.md)).
- An iPhone app that offers Google sign-in must also offer Sign in with Apple, under Apple's App Store rules. Apple sign-in is deferred until then.

Source: spec §14.
