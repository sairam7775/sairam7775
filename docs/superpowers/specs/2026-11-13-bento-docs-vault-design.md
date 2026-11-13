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
   - **Public vault:** this repo (`sairam7775/sairam7775`). The vault root is the repo root, so notes can link to code, `bento/CLAUDE.md` and `bento/DESIGN.md`. Build folders (`node_modules`, `.next` and so on) are hidden in Obsidian's settings; that's for tidiness only, not confidentiality.
   - **Private vault:** a new private repo, `sairam7775/bento-private`, cloned **next to** this repo. It holds business and finances, legal and company setup, partners, the confidential roadmap and pricing.
   - The public docs must be complete without the private vault.
   - *Rejected:* cloning the private repo inside the public one, hidden by `.gitignore`. `.gitignore` isn't a security boundary: a forced add, a copied attachment or an agent can still publish it, and a leak in a public repo can't be undone (Codex review, 2026-11-13).
2. **Cross-project lessons stay in `sairam7775/knowledge`.** Bento-specific checklists move into the Bento vault.
3. **Standard Markdown links with relative paths**, not `[[wikilinks]]`, so GitHub and agents can follow them.
4. **Few Obsidian plugins.** Obsidian Git for syncing; core Templates and Properties. Dataview is optional: every page must work without it. Canvas only as an extra, with a Markdown explanation next to it.
   - **Shared settings, public vault:** only `.obsidian/app.json` (excluded folders, link format, attachment folder) and `.obsidian/core-plugins.json` are committed, by an explicit allowlist in `.gitignore`. Workspace state (`workspace*.json`), community plugin folders and their data (Obsidian Git's `data.json` can hold tokens), and caches stay local.
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
| `code` | list of paths | The code and tests it describes |
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
- `bento/CLAUDE.md` keeps every critical rule as **one line with a link** to the note that explains it. It's loaded into every Claude session automatically, so the rules themselves stay in it; the long explanations move to the notes.
- **No rule may lose its conditions or exceptions** in the move. Before slimming, every rule in `bento/CLAUDE.md` is listed in a rule inventory (`90-archive/claude-md-rule-inventory.md`): the rule, its conditions and exceptions, and its new home. After slimming, each entry has a one-liner in `bento/CLAUDE.md` and the full text in its note.
- `bento/AGENTS.md` keeps its own working rules (branches, tests before finishing, no live database writes, no line-ending churn). Its pointer to `../docs/PROGRESS.md` changes to the new status page and the vault's start page.
- The block that `next dev` writes into `bento/CLAUDE.md` ("This is NOT the Next.js you know") stays as it is.
- Every change to these files is followed by a **fresh-session test from both the repo root and `bento/`**: a fresh `claude -p` and `codex exec`, without the rules in the prompt, must quote sample rules from the inventory (`knowledge/lessons/2026-11-10-agent-notes-must-load.md`).

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
   - **Properties:** every checked note has the required properties for its `type` (see the table above), with allowed values; every path in `code` is repo-relative and exists.
   - **Agent copies:** the root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` are byte-identical.
   - **Done when:** each of the four rules has a test case that fails on purpose (a broken link, a missing property, a missing `code` path, the agent copies differing) and passes once fixed.
   - *Deferred:* an advisory comment when code under a note's `code` path changed without the note. Added only if the Docs impact statements show it's needed.
5. **The owner's own edits:**
   - **Private vault:** Obsidian Git pulls on open and commits and pushes automatically.
   - **Public vault:** Obsidian Git **pulls only**; auto-commit and auto-push are off, so nothing is ever published automatically. The owner's edits are published through a PR like any other change. The owner can ask an agent to "publish my docs edits"; the agent shows the full diff, including attachments, checks it for anything confidential, and opens the PR.
   - **Deploys:** Vercel builds only when something under `bento/` changed. `bento/vercel.json` gets `"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."`. Vercel's root directory is `bento/`, so `.` means the app. The command exits 0 (skip) when nothing in `bento/` changed, and non-zero (build) when something did or when `HEAD^` isn't available. The existing `regions`, `github` and `crons` settings stay. Done when a docs-only commit is skipped and a mixed docs and app commit builds.
   - Agents' doc changes always go through PRs, with their code.
6. **Monthly review:** a short checklist note in `80-checklists/`, focused on notes where staleness is risky: security, privacy, costs and caps, operations. `last_reviewed` changes only for notes actually reviewed.

## Moving from today's files

Each step is one PR, reviewed by Codex. A file that moves leaves a short "Moved to …" note behind for a while.

| Step | What | Done when |
|---|---|---|
| 0 | The owner creates `sairam7775/bento-private` and clones it next to this repo; folders set up | `gh repo view sairam7775/bento-private --json visibility` says PRIVATE, and the vault opens in Obsidian |
| 1 | **Migration manifest** (`90-archive/migration-manifest.md`): every existing doc and every section of the big ones (`spec.html`, `bento/README.md`, `bento/CLAUDE.md`, `PROGRESS.md`, `design/`, `docs/design-references/`, `docs/superpowers/`), with its source, destination, any part kept where it is and why, and a status; plus every contradiction between them | Every doc and section has a row, and each contradiction has a proposed answer |
| 2 | Skeleton: start page, folders, templates, "which file wins" page, minimal Obsidian settings, Vercel ignored build step | Opens cleanly in Obsidian, and every link works |
| 3 | Pilot: Trip sharing documented end to end with the feature template | **The owner** confirms a third person would understand it |
| 4 | `spec.html` moved section by section, with a map from old § numbers to new notes; disagreements become open questions | Every § is mapped; the open questions are answered by the owner |
| 5 | Rule inventory, then `bento/CLAUDE.md` slimmed to one line per rule with links; `bento/AGENTS.md` pointers updated | Every inventory rule has its one-liner and its full note; fresh `claude -p` and `codex exec` from the repo root and from `bento/` quote sample rules |
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
| Slimming `CLAUDE.md` makes agents miss a rule or its exceptions | Rule inventory before and after; rules stay as one-liners in the file; fresh-session tests from both folders |
| Moving `spec.html` loses intent | The § map, plus open questions instead of silent choices; nothing archived until mapped |
| Vault upkeep becomes a burden | Few plugins; templates; agents do most of the writing as part of their PRs |
