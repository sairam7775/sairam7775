---
type: decision
status: accepted
date: 2026-09
---

# D1: Stack: Next.js and Supabase

## Context
Bento needed one deployable app with a relational database for trips → days → stops, SQL for the gap detector, and per-user data isolation.

## Decision
Next.js with Supabase (Postgres, row-level security, PostGIS).

## Consequences
Relational data fits trips, days and stops; RLS gives each traveller's data isolation almost free; PostGIS answers "what's near this stop".

## Today
In effect. The Supabase project moved from Mumbai to Tokyo in November 2026 (see [region move](../50-operations/supabase-region-move.md)).

Source: the original spec, §02 (decision D1). All decisions: [70-decisions](README.md).
