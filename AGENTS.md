# Repository guidelines

This repo holds two projects:

- `bento/`: the Bento Next.js app. Its working notes, invariants and commands are in `bento/CLAUDE.md`. Read that before changing Bento.
- `firebase-campaign-tool/`: a Node.js campaign CLI.

Design references are in `design/` and project documents are in `docs/`.

## Shared knowledge base

The owner keeps preferences, lessons from past fixes and reviews, and reusable checklists in a separate private repo, `sairam7775/knowledge`.

- In the owner's workspace: `../knowledge/`, next to this repo and its worktrees.
- Anywhere else (cloud sessions, a new machine): `gh repo clone sairam7775/knowledge`.

Before starting, read its `GUIDE.md`, its `preferences.md` and the checklist for your task in `checklists/`. Then search `lessons/` for the area you are changing.

After a fix, review or release that taught something reusable, add or update a lesson as its `README.md` describes. Evidence is required, and no secrets. Don't change `preferences.md`; propose changes to the owner.

If you can't reach the knowledge base, say so in your report instead of carrying on as if you had read it.
