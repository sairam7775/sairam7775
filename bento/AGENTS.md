# Bento — notes for coding agents

This project is worked on by more than one agent (Claude Code and Codex).
The project rules live in one place so they can't drift apart:

- **`CLAUDE.md`** (this folder) — architecture, invariants and conventions
  for the engine, Bento Man, the vault, transit and the database. Read it
  in full before changing code; everything in it applies to you too.
- **`DESIGN.md`** (this folder) — the visual system: tokens, type, motion,
  the seasonal backdrop. Read it before touching UI.
- **`../docs/PROGRESS.md`** — what has shipped and which review items are
  still open.

Don't copy rules from those files into this one; add new rules to
`CLAUDE.md` so both agents see them.

## Working alongside another agent

- Work on your own branch (or git worktree), never on a branch another
  agent has uncommitted work on. Keep each change small and on one topic.
- Before you finish: `npm test` (Vitest) and `npm run typecheck` must both
  pass. Bare `tsc` fails on a clean checkout; use the npm script.
- Never commit `.env.local` or print secrets. Never run anything that
  writes to the live Supabase project (migrations, `scripts/grant-admin.ts`,
  creating users) — write the migration file and leave applying it to the
  owner.
- New database views need an explicit revoke of write grants (see
  `supabase/migrations/0013_lock_public_views.sql`).
- Don't reformat or convert line endings in files you aren't changing;
  mixed-in whitespace churn hides the real diff from the reviewer.
- If you find a bug outside your task, note it in your summary rather than
  fixing it in the same change.
