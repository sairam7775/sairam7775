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
In effect: costs are stored in yen and converted on read (`fx_rates`).

Source: the original spec, §02 (decision D12). All decisions: [70-decisions](README.md).
