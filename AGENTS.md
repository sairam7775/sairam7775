<!-- AGENTS.md, CLAUDE.md and GEMINI.md hold the same text: edit all three together. Claude Code started in a subfolder (e.g. bento/) does not expand an @AGENTS.md import, so these are full copies. -->

# Repository guidelines

This repo holds two projects:

- `bento/`: the Bento Next.js app. Its working notes, invariants and commands are in `bento/CLAUDE.md`. Read that before changing Bento.
- `firebase-campaign-tool/`: a Node.js campaign CLI.

Design references are in `design/` and project documents are in `docs/`.

## Shared knowledge base

The owner keeps preferences, lessons from past fixes and reviews, and reusable checklists in a separate private repo, `sairam7775/knowledge`.

Its folder is `knowledge/`, next to this repo's root folder (paths here are relative to the repo root, not to `bento/`):

- In the owner's workspace it is already there, at `../knowledge/` from the root of the main checkout or of any worktree.
- Anywhere else (cloud sessions, a new machine), clone it from the repo root: `gh repo clone sairam7775/knowledge ../knowledge`. Never clone it inside this repo.

Before starting, read its `GUIDE.md`, its `preferences.md` and the checklist for your task in `checklists/`. Then search `lessons/` for the area you are changing.

After a fix, review or release that taught something reusable, add or update a lesson as its `README.md` describes. Evidence is required, and no secrets. Don't change `preferences.md`; propose changes to the owner.

If you can't reach the knowledge base, say so in your report instead of carrying on as if you had read it.
