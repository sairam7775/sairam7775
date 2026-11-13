---
type: design
status: accepted
code:
  - bento/src/
  - bento/supabase/migrations/
  - bento/vercel.json
last_reviewed: 2026-11-13
---

# Architecture

| Concern | Choice | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript; one deployable | Server actions and route handlers keep keys on the server, which matters because Bento holds booking references |
| UI | Tailwind v4 with Bento's own tokens and components | A design system in tokens (`globals.css`, [design](../20-design/README.md)). *The spec planned shadcn/ui; it isn't used* |
| Data and sign-in | Supabase: Postgres, Auth, PostGIS. Project in **Tokyo** (`ap-northeast-1`) since November 2026 | Row-level security isolates each traveller's data; PostGIS answers "what's near this stop" |
| Engine | Pure TypeScript in `bento/src/lib/engine/` | No framework, network or model; called from server code only ([engine](engine.md)) |
| Transit | Hand-built seeds (`bento/src/lib/transit/seed/`) loaded into a station graph | *The spec planned GTFS-JP and ODPT feeds.* ODPT's licence forbids redistributing its data from a public repo, so the networks are built by hand from open sources ([transit](transit.md)) |
| Language model | Bento Man through `provider.ts`: Anthropic (the code's default) or Google Gemini (production); Anthropic Haiku 4.5 to read pasted bookings | Intent and prose only ([Bento Man (software)](bento-man.md)) |
| Maps | No live maps; plain Google Maps links that open only when the traveller taps them | All planning data is local, so cost doesn't grow with users and the engine stays testable |
| Hosting | Vercel, functions in Tokyo (`hnd1`), next to the database | One chat turn makes several database round trips |
| Analytics | PostHog (EU), only with consent | See [privacy](../40-non-functional/privacy.md) |

## Core tables

| Table | Holds |
|---|---|
| `user_preferences` | Pace, interest tags, style axes, mobility, diet, display currency, exclusions (a hard filter, not a penalty), visible and editable by the traveller, never inferred silently |
| `trips` | Dates, party size, status |
| `trip_cities` | City, nights, order, reason, and the **budget per city**, not per trip (a ryokan night in Hakone mustn't make Tokyo's days look over budget) |
| `itinerary_days`, `itinerary_items` | One day per date; ordered stops with pinned flag, reason and reason terms |
| `bookings` | Type, reference (encrypted), provider, cost, the day it's planned on |
| `places` | The guide data, with verification status ([place data](place-data.md)) |
| `cities` | Region, prefecture, coverage tier ([coverage](../10-product/coverage.md)) |
| `stations`, `station_edges` | The train graph |
| `fx_rates` | Daily rates. Costs are stored in yen and converted on read, except booking costs, which keep the currency the traveller entered ([data model](data-model.md)) |
| `chat_messages` | The conversation, and the proposals made in it |
| Also | `trip_shares` (sharing), `trip_reviews`, `gap_dismissals`, `api_usage` (spend), `app_admins`, `place_review_notes`, `place_backgrounds`, rate-limit and write-usage tables |

Exact columns are in the migrations (`bento/supabase/migrations/`), which win over this table ([which file wins](../00-start/which-file-wins.md)). More in [data model](data-model.md).

## Security in the architecture

Because Bento holds booking references (a reference plus a surname is often enough to view or cancel a flight): references are encrypted at rest, never logged and never put in a model prompt; row-level security is on every table; pasted confirmations are read in a separate model call with no tools. Details: [security](../40-non-functional/security.md).

Source: spec §09; `bento/vercel.json`; `bento/README.md`.
