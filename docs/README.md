---
type: overview
status: accepted
---

# Bento

Bento is a Japan trip planner for first-time and returning travellers. You talk to a guide, **Bento Man**, and get a day-by-day plan built around opening hours, closures, travel time and pace, which says plainly what it doesn't know.

It's three parts, not one chat box:
1. **Bento Man,** the guide you talk to. A rented language model handles the conversation and the explanations only.
2. **The planner,** Bento's own code. It scores places for this traveller and builds days that respect opening hours, closures, travel time and pace. It's deterministic and testable, and it can explain itself.
3. **The booking vault.** Bookings the traveller adds are matched to nights and legs, and anything missing is named in plain words.

**The goal:** anyone can generate a Japan itinerary, but almost nobody makes one where the travel times are worked out, the constraints hold, and the plan admits what it doesn't know.

**Where it stands:**
- Bento's place and train information is seed data, checked by a person before travellers see it.
- Travel times come from Bento's own train network, which covers the cities Bento plans. A stop with no nearby station gets a flat estimate and a warning.
- Some fares aren't priced yet, and are shown as unpriced, never as free.

- **Today:** see [what works now](bento/00-start/status.md).
- **Known limits:** see the status page and [open questions](bento/00-start/README.md).

## Where to go next

**Understand the product** (for partners, designers, anyone new):
1. [Start here](bento/00-start/README.md): overview, glossary, status
2. [Product](bento/10-product/README.md): who it's for, and each feature
3. [Design](bento/20-design/README.md): the look, the screens, the guide's character
4. [Direction](bento/60-direction/README.md): where Bento is going

**Build and run it** (for developers and AI agents):
1. [Software](bento/30-software/README.md): architecture, data, integrations
2. [Non-functional](bento/40-non-functional/README.md): security, privacy, performance, accessibility, costs, reliability
3. [Operations](bento/50-operations/README.md): environments, deploys, runbooks
4. [Checklists](bento/80-checklists/README.md): release, review, the monthly docs review
5. [Decisions](bento/70-decisions/README.md): why things are the way they are
6. [Which file wins](bento/00-start/which-file-wins.md): where the truth lives for each kind of information

## About these documents

- They're an Obsidian vault: open this `docs/` folder in Obsidian, or read them here on GitHub.
- Business, finances, partners and the confidential roadmap are in a separate **private** vault (`bento-private`). These public notes are complete without it.
- **Docs change with the code.** Every change updates the notes it affects in the same pull request, and says so under "Docs impact".
- Older material is kept in the [archive](bento/90-archive/README.md).
