---
type: overview
status: accepted
---

# Glossary

| Term | Meaning |
|---|---|
| **Bento Man** | The guide the traveller talks to. A language model writes his words; Bento's own code decides every fact, time and plan he presents. Also the animated figure that goes with him |
| **Booking vault** (the *vault* in the app) | The part of a trip that holds the traveller's bookings and names what's still missing ("gaps"). Not to be confused with this **docs vault**, the Obsidian folder these notes live in |
| **Planner** or **engine** | Bento's own code that scores places and builds days (`bento/src/lib/engine/`). No model is involved |
| **Proposal** | A change Bento Man suggests (a route, days, new dates). Nothing changes until the traveller accepts it |
| **Diff** | How a proposal is shown: each stop marked kept, new, moved or out |
| **Day box** | The day view: a lacquer box of compartments sized to the time each stop takes |
| **Gap** | Something the trip still needs, such as a night with nowhere to sleep or a ticket not yet held. Gaps are *blocking*, *closing* (a booking window running out) or *worth knowing* |
| **Coverage** | How well Bento knows a city: how many of its places have been checked by a person. Bento only plans cities it knows well enough |
| **Draft** / **verified** (places) | Every place starts as a draft; a person checks it before travellers see its judgement fields |
| **Spend hold** | Money set aside before each model call so Bento can't exceed its monthly AI budget |
| **Share link** | A link that lets companions read a trip's plan without an account |
| **Seed** | The source data for places and trains, kept as TypeScript in the code and loaded into the database |
