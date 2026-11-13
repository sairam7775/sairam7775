---
type: design
status: draft
implementation: planned
date: 2026-11-13
---

# Bento documentation vault: design

## Why

Bento's knowledge is spread over seven places that disagree with each other:

| Today | Lines | Holds |
|---|---|---|
| `docs/spec.html` | 918 | Original design spec, called "the source of truth" |
| `bento/CLAUDE.md` | 608 | Agent rules, which also hold most product and technical rules |
| `bento/README.md` | 534 | Setup and technical notes |
| `docs/PROGRESS.md` | 294 | Phases and status |
| `bento/DESIGN.md` | 299 | Design system |
| `design/*.dc.html` | 7 files | Screen mock-ups |
| `docs/superpowers/` | 4 files (before this spec) | Feature designs and plans |
| `docs/design-references/` | 4 files | Other products' design systems, used as inspiration |

Examples of drift found on 2026-11-13:
- `design/README.md` describes an older font choice than `bento/DESIGN.md`.
- `PROGRESS.md` has a September "Last updated" header but November content.
- `spec.html` is called the source of truth in two places, while `CLAUDE.md` also says `globals.css` wins over `DESIGN.md`.

Someone new to the project can't tell which document is right.

## Goal

- All Bento documentation lives in a structured **Obsidian vault**.
- It covers product and feature specs, design, non-functional requirements, the software spec, operations, direction, decisions and checklists.
- A third person can understand Bento from it without reading code or chat history.
- Documents are updated **in the same change as the code**, never afterwards.

**Readers:** both
- a **new developer or AI agent**, who needs to know how it's built, the rules that mustn't break, and how to run, test and deploy it;
- a **partner, investor, adviser or designer**, who needs to know what it is, who it's for, what works, where it's going, and the design.

Both start from one plain-language page and then take separate routes.

**Language:** English only for now.

## Decisions

1. **Two vaults, two repos, side by side.** They are never nested.
   - **Public vault:** the `docs/` folder of this repo (`sairam7775/sairam7775`). Obsidian opens `docs/` in a **dedicated copy** of the repo, the git worktree `sairam7775-vault` on the branch `docs/owner`, never in a copy where code is being built.
     - Notes link to code and to `bento/CLAUDE.md` and `bento/DESIGN.md` with relative paths (`../../bento/…`). Those links work on GitHub and for agents, but don't open inside Obsidian.
     - *Rejected:* the repo root as the vault. Obsidian reads every file in the vault, and `node_modules` alone holds tens of thousands (agy review, 2026-11-13).
   - **Private vault:** a new private repo, `sairam7775/bento-private`, cloned **next to** this repo. It holds business and finances, legal and company setup, partners, the confidential roadmap and pricing.
   - The public docs must be complete without the private vault.
   - *Rejected:* cloning the private repo inside the public one, hidden by `.gitignore`. `.gitignore` isn't a security boundary: a forced add, a copied attachment or an agent can still publish it, and a leak in a public repo can't be undone (Codex review, 2026-11-13).
2. **Cross-project lessons stay in `sairam7775/knowledge`.** Bento-specific checklists move into the Bento vault.
3. **Standard Markdown links with relative paths**, not `[[wikilinks]]`, so GitHub and agents can follow them.
4. **Few Obsidian plugins.** Core Templates and Properties in both vaults; Obsidian Git in the **private vault only**. Dataview is optional: every page must work without it. Canvas only as an extra, with a Markdown explanation next to it.
   - **Shared settings, public vault:** only `docs/.obsidian/app.json` (link format, attachment folder) and `docs/.obsidian/core-plugins.json` are committed, by an explicit allowlist in `.gitignore`. Workspace state (`workspace*.json`), community plugin folders and their data (Obsidian Git's `data.json` can hold tokens), and caches stay local.
   - **Attachments** go to `docs/bento/_attachments/` in the public vault, and to the private vault's own `_attachments/`, never to a shared folder.
5. **The source of truth depends on the topic.** There's no single "source of truth" document. See [Which file wins](#which-file-wins).

## Structure of the public vault

The start page is `docs/README.md`, linked from the repo's `README.md`. It says what Bento is, who it's for, what works today, the known limits and where to go next, with two routes: **Understand the product** and **Build and run it**.

Bento's notes are under `docs/bento/`:

| Folder | Holds |
|---|---|
| `00-start/` | Overview, the two reading routes, glossary (including the difference between Bento's *booking vault* and this *docs vault*), the current status page |
| `10-product/` | Vision, users, one note per feature |
| `20-design/` | Design system (links to `bento/DESIGN.md`), screens, and which mock-ups are current, exploratory or inspiration |
| `30-software/` | Architecture, data model, integrations, data sources and licences, freshness of data |
| `40-non-functional/` | Security, privacy and APPI, performance, accessibility, costs and caps, reliability |
| `50-operations/` | Environments, deploys, runbooks |
| `60-direction/` | Public roadmap. Confidential plans go in the private vault |
| `70-decisions/` | One short record per decision: what, why, date, what it replaces |
| `80-checklists/` | Bento-specific checklists (release, review, monthly docs review) |
| `90-archive/` | `spec.html`, old plans and the map from old § numbers to new notes |

`docs/bento/_templates/` holds one template per note type.

**What each note type must contain:**
- **Feature:** summary, user journey, acceptance criteria, what it doesn't do, failure behaviour, code and tests, related decisions.
- **Non-functional:** the target, how it's checked, the evidence, known gaps.
- **Decision:** context, decision, alternatives considered, consequences, date, and what it supersedes.
- **Runbook:** when to use it, the steps, how to check it worked, how to undo it.

**Properties at the top of every note:**

| Property | Values | Notes |
|---|---|---|
| `type` | feature, non-functional, decision, runbook, checklist, overview, design | Required |
| `status` | draft, accepted, superseded | Required. Is this the agreed version? |
| `implementation` | planned, partial, shipped, n/a | Required for feature and non-functional. Accepted ≠ shipped |
| `code` | list of repo-relative paths, files or folders | The code and tests it describes. Prefer a folder (`bento/src/lib/trips/`) over listing every file |
| `last_reviewed` | date | Changed only after a real review |
| `supersedes` | link | When it replaces something |

## Which file wins

| Information | Authority |
|---|---|
| Intended behaviour and product rules | The feature or non-functional note |
| Why something is the way it is | Decision records |
| Exact schema | `bento/supabase/migrations/` |
| Design tokens | `bento/src/app/globals.css`; `bento/DESIGN.md` describes them |
| Words shown to users | `bento/src/copy/en.ts` |
| Generated data (seeds) | Their TypeScript source in `bento/src/lib/**/seed/` |
| How agents must work, and what they must read | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` |
| Original intent | `90-archive/` (spec.html and dated plans) |

- When a note and the code disagree, the disagreement is written down as an open question for the owner; neither side is silently treated as right.
- Critical rules are also enforced by tests or database constraints wherever possible, so a note that falls behind can't by itself cause harm.

**Agent files:**
- **Two tiers, on purpose.** The root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` are short and identical: what's in the repo, where the knowledge base is, and the docs rule. `bento/CLAUDE.md` holds Bento's rules, and `bento/AGENTS.md` points Codex at it. An agent working in `bento/` loads both tiers; this was tested on PR #63.
- `bento/CLAUDE.md` keeps every critical rule **with its conditions and exceptions**, written briefly, plus a link to the note that explains it. Claude loads this file into every session but doesn't follow links by itself, so anything an agent must obey while coding stays in the file. Only the reasons, history, examples and long detail move to the notes (agy review, 2026-11-13).
- **No rule may lose a condition or exception.** The migration manifest has a section listing every rule in `bento/CLAUDE.md` with its conditions, exceptions and new note. After the change, each one is still in `bento/CLAUDE.md` with the same conditions.
- `bento/AGENTS.md` keeps its own working rules (branches, tests before finishing, no live database writes, no line-ending churn). Its pointer to `../docs/PROGRESS.md` changes to the new status page and the vault's start page.
- The block that `next dev` writes into `bento/CLAUDE.md` ("This is NOT the Next.js you know") stays as it is.
- Every change to these files is followed by a **fresh-session test from both the repo root and `bento/`**: a fresh `claude -p` and `codex exec`, without the rules in the prompt, must quote sample rules, with their exceptions, from the manifest (`knowledge/lessons/2026-11-10-agent-notes-must-load.md`).

## Keeping it current

1. **Before writing code,** an agent lists the notes the change affects.
2. **In the same PR,** it updates them.
3. **Every PR has a Docs impact section** (`.github/pull_request_template.md`):
   - "Updated: `<notes>` (what changed)", or
   - "No docs impact, because: `<reason>`".

   The reviewer checks it like any other part of the PR. The same applies to direct commits.
4. **Automatic checks** (GitHub Action, new to this repo), all **blocking**:
   - **Notes checked:** `docs/README.md` and `docs/bento/**/*.md`, except `docs/bento/_templates/` and `docs/bento/_attachments/`. In `docs/bento/90-archive/` only links are checked, not properties. Other Markdown in the repo (`bento/CLAUDE.md`, `docs/superpowers/`, the CLI) is not checked.
   - **Links:** every relative link in a checked note must point at a file that exists (another note, code or an attachment). Heading anchors (`#section`) aren't checked yet.
   - **Properties:** every checked note has the required properties for its `type` (see the table above), with allowed values; every path in `code` is repo-relative and exists as a file or folder. A rename that breaks one is meant to fail: the note describing that code needs updating.
   - **Agent copies:** the root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` are byte-identical.
   - **Done when:** each of the four rules has a test case that fails on purpose (a broken link, a missing property, a missing `code` path, the agent copies differing) and passes once fixed.
   - *Deferred:* an advisory comment when code under a note's `code` path changed without the note. Added only if the Docs impact statements show it's needed.
5. **The owner's own edits:**
   - **Private vault:** Obsidian Git pulls on open and commits and pushes automatically.
   - **Public vault:** no Obsidian Git, so nothing is ever published automatically and pulls never clash with unsaved edits. The owner edits in the `sairam7775-vault` copy on the branch `docs/owner`. Two requests to an agent handle syncing:
     - **"Refresh my docs":** commits nothing; brings the latest `main` into `docs/owner`, stashing and restoring any unsaved edits, and reports any clash instead of leaving conflict markers in a note.
     - **"Publish my docs edits":** shows the full diff, including attachments, checks it for anything confidential, commits on `docs/owner` and opens a PR. After the merge, `docs/owner` is moved to the new `main`.
   - **Deploys:** Vercel builds only when something under `bento/` changed since the branch's last successful deployment. `bento/vercel.json` gets `"ignoreCommand": "[ -n \"$VERCEL_GIT_PREVIOUS_SHA\" ] && git diff --quiet \"$VERCEL_GIT_PREVIOUS_SHA\" HEAD -- ."`.
     - Vercel's root directory is `bento/`, so `.` means the app.
     - The command exits 0 (skip) only when nothing in `bento/` changed. It exits non-zero (build) when something did, when `VERCEL_GIT_PREVIOUS_SHA` is empty (a branch's first deploy), or when that commit isn't in the clone.
     - Comparing with the last deployment, not `HEAD^`, covers pushes of several commits at once (agy review, 2026-11-13).
     - The existing `regions`, `github` and `crons` settings stay.
     - Done when a docs-only push is skipped, a push with an app commit followed by a docs commit builds, and a new branch's first push builds.
   - Agents' doc changes always go through PRs, with their code.
6. **Monthly review:** a short checklist note in `80-checklists/`, focused on notes where staleness is risky: security, privacy, costs and caps, operations. `last_reviewed` changes only for notes actually reviewed.

## Moving from today's files

The steps are grouped into **four PRs**, each reviewed by Codex:
- **PR A:** steps 1 and 2. Step 0 happens outside this repo.
- **PR B:** step 3, the pilot, so the owner can judge the format early.
- **PR C:** steps 4 to 6, the content.
- **PR D:** steps 7 and 8, checks and clean-up.

PR C may be split if it gets too big to review. A file that moves leaves a short "Moved to …" note behind until step 8.

| Step | What | Done when |
|---|---|---|
| 0 | The owner creates `sairam7775/bento-private` and clones it next to this repo; folders set up. The `sairam7775-vault` worktree on `docs/owner` is created | `gh repo view sairam7775/bento-private --json visibility` says PRIVATE, and both vaults open in Obsidian |
| 1 | **Migration manifest** (`90-archive/migration-manifest.md`): every existing doc and every section of the big ones (`spec.html`, `bento/README.md`, `bento/CLAUDE.md`, `PROGRESS.md`, `design/`, `docs/design-references/`, `docs/superpowers/`), with its source, destination, any part kept where it is and why, and a status; plus every contradiction between them | Every doc and section has a row, and each contradiction has a proposed answer |
| 2 | Skeleton: start page, folders, templates, "which file wins" page, minimal Obsidian settings, Vercel ignored build step | Opens cleanly in Obsidian, and every link works |
| 3 | Pilot: Trip sharing documented end to end with the feature template | **The owner** confirms a third person would understand it |
| 4 | `spec.html` moved section by section, with a map from old § numbers to new notes; disagreements become open questions | Every § is mapped; the open questions are answered by the owner |
| 5 | `bento/CLAUDE.md` trimmed: reasons, history and long detail move to notes; every rule stays with its conditions and exceptions, plus a link; `bento/AGENTS.md` pointers updated | Every rule in the manifest's rule list is still in `bento/CLAUDE.md` with the same conditions; fresh `claude -p` and `codex exec` from the repo root and from `bento/` quote sample rules with their exceptions |
| 6 | `PROGRESS.md` becomes one status page. `bento/README.md` keeps a short quick start, its setup and deploy parts move to `50-operations/`, and its technical parts to `30-software/`. Design docs sorted, with `docs/design-references/` going to `20-design/inspiration/`. Runbooks written (Supabase region move, Gmail SMTP); non-functional notes get targets and evidence | Every manifest row for these sources is done; no competing status pages remain |
| 7 | PR template, GitHub Action, docs rule in all three root files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, changed together) and in `bento/CLAUDE.md`, Vercel ignore command, first monthly review | Each check's failing test case fails and then passes; a docs-only commit skips the Vercel build |
| 8 | `spec.html` and old plans move to `90-archive/`, marked historical; inbound links updated; "Moved to …" notes removed once nothing links to them | Every manifest row is done, and a link check of the whole repo finds no link to a moved file |

`bento/DESIGN.md` and `bento/CLAUDE.md` stay where they are, because developers and agents expect them next to the code.

## Not in scope

- Japanese versions (later, if partners need them).
- Generating docs from code, and the deferred code-path comment.
- Docs for `firebase-campaign-tool`, which can follow the same pattern later.
- A public docs website. Reading on GitHub and in Obsidian is enough for now.

## Risks

| Risk | Mitigation |
|---|---|
| Confidential text lands in the public vault | Separate repos; the public vault never auto-pushes; every public change goes through a PR whose full diff, including attachments, is checked; Obsidian's local settings and plugin data are never committed |
| Notes drift from the code again | Docs impact statement in every PR; monthly review; the code-path comment if that proves not enough |
| Trimming `CLAUDE.md` makes agents miss a rule or its exceptions | Rules and their exceptions stay in the file, and only explanations move; the manifest's rule list is checked before and after; fresh-session tests from both folders |
| The owner's draft edits clash with agents' merged changes | A dedicated vault copy on its own branch; no automatic pulls; "Refresh my docs" stashes and reports clashes instead of writing conflict markers |
| Moving `spec.html` loses intent | The § map, plus open questions instead of silent choices; nothing archived until mapped |
| Vault upkeep becomes a burden | Few plugins; templates; agents do most of the writing as part of their PRs |
