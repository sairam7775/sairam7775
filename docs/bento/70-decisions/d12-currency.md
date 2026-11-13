---
type: decision
status: accepted
date: 2026-09
---

# D12: Currency: show any, store yen

## Context
Travellers think in their own currency, but storing converted amounts bakes in a rate that goes stale.

## Decision
Store every cost in yen; convert only when showing it, with daily rates and the rate's date shown.

## Consequences
A stale rate can never be stored in the data; staleness is visible.

## Today
In effect for places, plans and budgets: stored in yen and converted on read (`fx_rates`). **Booking costs are the exception:** they keep the amount and currency the traveller entered, with a yen value only when they entered yen, and are converted on read ([data model](../30-software/data-model.md)).

Source: the original spec, §02 (decision D12). All decisions: [70-decisions](README.md).
