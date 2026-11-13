# Bento

A trip planner for people who have never been to Japan: one that gives the honest version of every place, every train and every gap in the plan.

**All documentation is in the docs vault: start at [`../docs/README.md`](../docs/README.md).** That covers the product, design, software, security and privacy, operations and status. The rules agents must follow are in [`CLAUDE.md`](CLAUDE.md) (and [`AGENTS.md`](AGENTS.md) for Codex), and the design system is in [`DESIGN.md`](DESIGN.md).

## Quick start

```bash
npm ci
cp .env.example .env.local   # fill in the Supabase URL and keys; never commit it
npm run dev
```

Before calling a change done, all four must pass: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

- Full setup (migrations, seeds, curation access): [local setup](../docs/bento/50-operations/local-setup.md)
- Deploying: [deploying](../docs/bento/50-operations/deploying.md)
- Commands and scripts: [commands](../docs/bento/30-software/commands.md)
- Where the code is: [layout](../docs/bento/30-software/layout.md)
- What's built and what's open: [status](../docs/bento/00-start/status.md)

The older, longer version of this README is in git history (before 13 November 2026). Its sections now live in the vault notes listed in the [migration manifest](../docs/bento/90-archive/migration-manifest.md).
