---
type: overview
status: accepted
---

# Which file wins

There's no single "source of truth" document. For each kind of information, one place decides:

| Information | Authority |
|---|---|
| Intended behaviour and product rules | The feature or non-functional note |
| Why something is the way it is | Decision records |
| Exact schema | `bento/supabase/migrations/` |
| Design tokens | `bento/src/app/globals.css`; `bento/DESIGN.md` describes them |
| Words shown to users | `bento/src/copy/en.ts` |
| Generated data (seeds) | Their TypeScript source in `bento/src/lib/**/seed/` |
| How agents must work, and what they must read | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` |
| Original intent | The [archive](../90-archive/README.md) (the original spec and dated plans) |

- When a note and the code disagree, the disagreement is written down as an open question for the owner. Neither side is silently treated as right.
- Critical rules are also enforced by tests or database constraints wherever possible, so a note that falls behind can't by itself cause harm.

Source: [the vault design](../../superpowers/specs/2026-11-13-bento-docs-vault-design.md).
