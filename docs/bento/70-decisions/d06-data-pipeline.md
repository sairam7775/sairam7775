---
type: decision
status: accepted
date: 2026-09
---

# D6: Data pipeline: open data, AI drafts, a human verifies

## Context
Hand-writing 2,000 records to the quality bar would take more than 500 hours.

## Decision
Build records from open data, let a model draft the judgement fields, and have a human verify every record before travellers see it.

## Consequences
Roughly 150 hours instead of 500. It needs a hard gate: a drafted field is never shown until a person has checked it (see [curation](../50-operations/curation.md)).

## Today
In effect. Draft fields are also cross-checked by two AI reviewers (Codex and Gemini), whose disagreements become review notes for the admin.

Source: the original spec, §02 (decision D6). All decisions: [70-decisions](README.md).
