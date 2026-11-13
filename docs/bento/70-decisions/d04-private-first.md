---
type: decision
status: accepted
date: 2026-09
---

# D4: Audience: private first, open later

## Context
Opening to the public brings marketing, verification flows and legal pages; a private tool doesn't need them on day one, but security can't be added later.

## Decision
Start private. Build row-level security, spend caps and encryption from the first day; defer public-facing work.

## Consequences
The safety work was never retrofitted. The public-facing work came later: legal pages, an age screen, account deletion, consent for analytics, and the November 2026 security hardening.

## Today
The deferred public-facing work has since shipped (see [privacy](../40-non-functional/privacy.md) and [security](../40-non-functional/security.md)). When to open sign-ups widely is the owner's decision.

Source: the original spec, §02 (decision D4). All decisions: [70-decisions](README.md).
