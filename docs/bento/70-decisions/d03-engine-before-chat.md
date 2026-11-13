---
type: decision
status: accepted
date: 2026-09
---

# D3: Build order: the engine before the chat

## Context
A chat interface is easy to demo and tempting to build first, but the model would then depend on a schema that hadn't been proven.

## Decision
Build the planner engine first, then the conversation.

## Consequences
Nothing was demo-able for weeks, but the schema and the engine were tested before the model relied on them.

## Today
Done: all eight build phases shipped in this order (see [status](../00-start/status.md)).

Source: the original spec, §02 (decision D3). All decisions: [70-decisions](README.md).
