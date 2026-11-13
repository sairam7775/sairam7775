# Bento documentation vault: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All of Bento's documentation lives in a structured, checked Obsidian vault (`docs/`), plus a private sibling vault (`bento-private`), and is kept current with every change.

**Architecture:** Markdown notes with YAML properties, under `docs/bento/` in numbered folders. A dependency-free Node checker (`tools/docs-check/`) enforces links, properties and agent-file copies, locally and in a GitHub Action. Existing documents move in through a migration manifest, so nothing is lost.

**Tech stack:** Markdown, Obsidian (core Templates and Properties), Node 24 (`node:test`, `node:fs`), GitHub Actions, Vercel `ignoreCommand`.

**Spec:** `docs/superpowers/specs/2026-11-13-bento-docs-vault-design.md`. Read it first; this plan argues from it.

## Global constraints

- English only. Links are relative Markdown links (`[text](../path.md)`); no `[[wikilinks]]`.
- Nothing confidential in this repo, which is **public**: business, finances, partners, pricing, the confidential roadmap and personal details go in `bento-private` only.
- Every note under `docs/bento/` (except `_templates/`, `_attachments/` and `90-archive/`) carries these properties:
  - `type`: `feature`, `non-functional`, `decision`, `runbook`, `checklist`, `overview` or `design`;
  - `status`: `draft`, `accepted` or `superseded`;
  - `implementation` (required for `feature` and `non-functional`): `planned`, `partial`, `shipped` or `n/a`;
  - optional `code` (a list of repo-relative files or folders), `last_reviewed` (YYYY-MM-DD) and `supersedes` (a link).
- Obsidian's vault root is `docs/`. Only `docs/.obsidian/app.json` and `docs/.obsidian/core-plugins.json` are committed. Attachments go to `docs/bento/_attachments/`.
- `bento/DESIGN.md` and `bento/CLAUDE.md` stay where they are. Rules in `bento/CLAUDE.md` keep their conditions and exceptions inline.
- The root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` stay byte-identical and change together.
- Commits: short, imperative, ending with the session's attribution lines. Each PR has a **Docs impact** section, gets a Codex review (read-only snapshot, no `.env` files), and is merged only by the owner's decision.

## Review focus

These are not covered by the spec's own "done when" tests, and are the most likely to bite. Each has a test in Task 1.
1. **CRLF line endings** (Windows and Notepad edits): frontmatter must still parse. Test `parses frontmatter with CRLF`.
2. **Case mismatch** (`Trip-Sharing.md` vs `trip-sharing.md`) passes on Windows but breaks on Linux and GitHub: the link check compares exact case. Test `fails a link whose case differs`.
3. **Encoded or spaced paths** (`%20`, `<path with spaces>`): resolve them, don't report them. Test `resolves percent-encoded links`.
4. **Links inside code** (fenced blocks, inline backticks), such as the examples in templates and this plan: they aren't checked. Test `ignores links in code`.
5. **A UTF-8 BOM** at the start of a file (Notepad): it mustn't hide the frontmatter. Test `parses frontmatter after a BOM`.

---

## PR A: manifest and skeleton (spec steps 0 to 2)

Branch `claude/docs-vault-a` from `main`, after PR #66 is merged.

### Task 0: Private vault and the owner's vault copy (spec step 0)

**Files (outside this repo):**
- Create: `../bento-private/` with `README.md` (start page), `business/`, `legal/`, `partners/`, `roadmap/`, `pricing/`, `_templates/`, `_attachments/` (each with a `README.md` saying what goes there), and `.gitignore` containing `.obsidian/workspace*.json`, `.obsidian/cache` and `.trash/`.
- Create the worktree: `git -C ../sairam7775 worktree add ../sairam7775-vault -b docs/owner origin/main`.

- [ ] **Step 1:** The owner runs `! gh repo create sairam7775/bento-private --private --clone` from `D:\Sai`s WorkSpace\Claude`. (The agent's earlier `gh repo create` was refused by the permission check, so the owner runs it.)
- [ ] **Step 2:** Verify that `gh repo view sairam7775/bento-private --json visibility -q .visibility` prints `PRIVATE`. Stop if it doesn't.
- [ ] **Step 3:** Create the folders and READMEs above. Commit with `Set up the private Bento vault` and push.
- [ ] **Step 4:** Create the `sairam7775-vault` worktree. It has no `node_modules`, so no junction risk.
- [ ] **Step 5:** The owner opens `../bento-private` and `../sairam7775-vault/docs` as two vaults in Obsidian, and installs Obsidian Git **in the private vault only**: pull on startup, auto-commit and push every 10 minutes.

### Task 1: The docs checker

**Files:**
- Create: `tools/docs-check/check-docs.mjs` (library plus CLI).
- Create: `tools/docs-check/check-docs.test.mjs`.
- Create: `tools/docs-check/README.md` (what it checks and how to run it).

**Interfaces (produces):**
- `parseFrontmatter(text: string): { data: Record<string, string | string[]>, body: string } | null`. Handles a BOM, CRLF, `key: value`, `key: [a, b]` and block lists (`key:` followed by `  - item` lines). Returns `null` when there's no frontmatter.
- `extractLinks(body: string): string[]`. Returns the targets of `[..](target)` and `![..](target)`, skipping fenced code blocks and inline code, and skipping `http:`, `https:`, `mailto:` and `#…` targets. Strips the `#anchor` and `?query`, decodes `%xx`, and removes `<…>` brackets.
- `checkNote(file: string, text: string, repoRoot: string): Problem[]`.
- `checkAgentCopies(repoRoot: string): Problem[]`.
- `collectNotes(repoRoot: string): string[]`. Returns `docs/README.md` plus `docs/bento/**/*.md`, excluding `docs/bento/_templates/**` and `docs/bento/_attachments/**`.
- `type Problem = { file: string, rule: "link" | "property" | "code-path" | "agent-copies", message: string }`.
- CLI: `node tools/docs-check/check-docs.mjs [repoRoot]` (default `.`) runs `checkNote` on every file from `collectNotes`, plus `checkAgentCopies`. It prints one line per problem (`<file>: [<rule>] <message>`) and exits 1 if there are any, 0 otherwise.
- Notes under `docs/bento/90-archive/` get **links checked only**, with no property rules.
- Every existence check matches **exact case**, by comparing with `readdirSync` of the parent folder.

- [ ] **Step 1: Write the failing tests** in `check-docs.test.mjs`, using `node:test`. Each test builds a temporary repo with `fs.mkdtempSync`:
  - `passes a note with valid properties and links`: a feature note with `type: feature`, `status: accepted` and `implementation: shipped`, linking `../other.md`, which exists → `[]`.
  - `fails a broken link`: a link to `missing.md` → one problem, rule `link`.
  - `fails a link whose case differs`: the file is `trip-sharing.md`, the link is `Trip-Sharing.md` → rule `link`.
  - `resolves percent-encoded links`: the file is `my note.md`, the link is `my%20note.md` → `[]`.
  - `ignores links in code`: a link to `missing.md` inside a fenced block and inside backticks → `[]`.
  - `ignores external and anchor links`: `https://x.test`, `mailto:a@b.test` and `#section` → `[]`.
  - `fails a missing type`, `fails an unknown status value` (`status: done`), and `fails a feature without implementation` → rule `property`.
  - `fails a missing code path` (`code: [bento/src/nope.ts]`) → rule `code-path`; `accepts a code folder` (`code: [bento/src/lib/]`, which exists) → `[]`.
  - `checks only links in the archive`: a `90-archive` note with no properties and a valid link → `[]`; with a broken link → rule `link`.
  - `skips templates`: `collectNotes` doesn't return `docs/bento/_templates/feature.md`.
  - `parses frontmatter with CRLF` and `parses frontmatter after a BOM` → `data.type === "feature"`.
  - `fails when agent copies differ`: the root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`, one of them differing → rule `agent-copies`; all identical → `[]`.
- [ ] **Step 2:** Run `node --test tools/docs-check/`. Expected: FAIL (the module isn't found).
- [ ] **Step 3:** Implement the interfaces above in `check-docs.mjs`, with only built-in modules. The allowed values come from the Global constraints.
- [ ] **Step 4:** Run `node --test tools/docs-check/`. Expected: all pass.
- [ ] **Step 5:** Run `node tools/docs-check/check-docs.mjs .` on the real repo. Expected: exit 0. Only `docs/README.md` is in scope and it doesn't exist yet, so this checks the agent copies alone; they're identical today.
- [ ] **Step 6:** Commit with `Add a checker for the docs vault`.

### Task 2: Skeleton (spec step 2)

**Files:**
- Create: `docs/README.md`, the start page. It covers what Bento is (from `spec.html`'s "What this actually is"), who it's for, what works today (link to the status page), the known limits, the two routes (**Understand the product** → 00-start, 10, 20, 60; **Build and run it** → 30, 40, 50, 80), the private vault (named, not linked), and how to update docs.
- Create one `README.md` per folder `docs/bento/{00-start,10-product,20-design,30-software,40-non-functional,50-operations,60-direction,70-decisions,80-checklists,90-archive}/`, saying what belongs there (the spec's structure table), with `type: overview` and `status: accepted`.
- Create: `docs/bento/00-start/which-file-wins.md`, the spec's authority table, verbatim.
- Create: `docs/bento/00-start/glossary.md`. It includes the booking *vault* vs the docs *vault*, coverage tiers, Bento Man, proposal, gap and spend hold. The definitions come from `bento/CLAUDE.md`.
- Create: `docs/bento/00-start/status.md`, a placeholder with `status: draft`, linking to `../../PROGRESS.md` until Task 6.
- Create: `docs/bento/_templates/{feature,non-functional,decision,runbook,checklist,overview,design}.md`, each with the properties block and the required section headings from the spec ("What each note type must contain").
- Create: `docs/bento/_attachments/.gitkeep`.
- Create: `docs/.obsidian/app.json` with `{"useMarkdownLinks": true, "newLinkFormat": "relative", "attachmentFolderPath": "bento/_attachments", "alwaysUpdateLinks": true}`, and `docs/.obsidian/core-plugins.json` enabling `templates`, `properties`, `file-explorer`, `global-search`, `backlink`, `outline` and `graph`. Also `docs/.obsidian/templates.json` with `{"folder": "bento/_templates"}`, which needs adding to the allowlist below.
- Create: `/.gitignore` (the repo root has none) with `docs/.obsidian/*`, then the exceptions `!docs/.obsidian/app.json`, `!docs/.obsidian/core-plugins.json` and `!docs/.obsidian/templates.json`.
- Modify: `README.md` (root), adding a first line linking `docs/README.md`.

- [ ] **Step 1:** Write the files above.
- [ ] **Step 2:** Run `node tools/docs-check/check-docs.mjs .`. Expected: exit 0.
- [ ] **Step 3:** Run `git status --ignored docs/.obsidian`. Expected: only the three allowed files are tracked. Create a dummy `docs/.obsidian/workspace.json` and confirm it's ignored, then delete it.
- [ ] **Step 4: Owner gate.** After the branch is pushed, the owner checks it out in `sairam7775-vault` (`git -C ../sairam7775-vault fetch && git -C ../sairam7775-vault checkout claude/docs-vault-a`; switch back to `docs/owner` afterwards), opens `docs` in Obsidian, and confirms:
  - the start page shows;
  - the templates appear under "Insert template";
  - a new pasted image lands in `bento/_attachments/`.

  The checker in step 2 already proves the links.
- [ ] **Step 5:** Commit with `Add the docs vault skeleton`.

### Task 3: Migration manifest (spec step 1)

**Files:**
- Create: `docs/bento/90-archive/migration-manifest.md`.

It contains:
- **Section "Documents":** one row per existing doc **and** per `##` heading of the large ones. Columns: Source, Section, Destination note, Kept in place (why), Status (`todo`, `done` or `kept`). Sources:
  - `docs/spec.html`: the 18 `h2`/`h3` sections, using their headings and § numbers;
  - `bento/README.md`: its 14 `##` sections;
  - `docs/PROGRESS.md`: 10 sections;
  - `bento/DESIGN.md` and `bento/CLAUDE.md`: per heading;
  - each `design/*.dc.html` and `design/README.md`;
  - each `docs/design-references/*`;
  - each `docs/superpowers/**` file.
- **Section "Rules in bento/CLAUDE.md":** one row per bullet under `## Invariants` and per rule bullet in the other sections. Columns: Rule (short name), Conditions and exceptions (verbatim), Note it's explained in, Still in CLAUDE.md (yes/no).
- **Section "Contradictions":** one row each, with Proposed answer and Owner decision columns. At least:
  - the fonts (`design/README.md` vs `bento/DESIGN.md`);
  - "source of truth" (`spec.html` vs the `globals.css` rule);
  - `PROGRESS.md`'s "Last updated" header;
  - any spec vs code difference found while reading.

Steps:
- [ ] **Step 1:** Write the manifest.
- [ ] **Step 2:** Run `grep -c "^## " bento/README.md docs/PROGRESS.md` and `grep -cE "<h[23]" docs/spec.html`, and compare with the manifest's row counts per source. Expected: they're equal.
- [ ] **Step 3:** Run `node tools/docs-check/check-docs.mjs .`. Expected: exit 0.
- [ ] **Step 4:** Commit with `Add the docs migration manifest`.
- [ ] **Step 5:** Open PR A, with a Docs impact section and the validation output. Get a Codex review; fix what's accepted. The owner answers the **Contradictions** rows, with the answers recorded in the manifest, and merges.

## PR B: pilot (spec step 3)

### Task 4: Trip sharing, end to end

**Files:**
- Create: `docs/bento/10-product/trip-sharing.md`, from `_templates/feature.md`. Properties: `type: feature`, `status: accepted`, `implementation: shipped`, and `code: [bento/src/lib/trips/share-expiry.ts, bento/src/lib/trips/shared-plan.ts, bento/src/app/shared/, bento/src/components/plan/, bento/supabase/migrations/0020_trip_sharing.sql, bento/supabase/migrations/0024_share_expiry.sql]` (confirm each path exists).
- Create: `docs/bento/70-decisions/2026-10-share-links-by-token.md` (`type: decision`). It records why the link is the only key: the 32-hex-character token, no account needed, and no referrer or analytics on `/shared/`.
- Modify: `docs/bento/90-archive/migration-manifest.md`, marking `bento/CLAUDE.md` "Sharing" as explained in the new note.

Sections (from the template):
- **Summary**, for a partner, in plain words.
- **User journey:** share → choose an expiry (none, 7 days, 30 days, until the trip ends) → companion opens the link → the owner stops or renews it.
- **Acceptance criteria:** each one testable, taken from `bento/CLAUDE.md` "Sharing" and the code.
- **What it doesn't do:** no editing by companions; no references, notes, providers or costs shown; no owner details beyond the pace.
- **Failure behaviour:** an expired or unknown token both show nothing; a stopped link stops working; a renewed link kills the old one.
- **Code and tests:** links to the files and their `*.test.ts`.
- **Related decisions:** link to the decision note.

- [ ] **Step 1:** Read the code and tests listed above, and `bento/CLAUDE.md` "Sharing". Write the two notes, with every claim matching the code. Anything unclear goes into the manifest's Contradictions.
- [ ] **Step 2:** Run `node tools/docs-check/check-docs.mjs .`. Expected: exit 0.
- [ ] **Step 3:** Commit with `Document trip sharing as the vault pilot`, open PR B, and get a Codex review.
- [ ] **Step 4: Owner gate.** The owner reads `trip-sharing.md` and says whether a third person would understand it. Their feedback changes the **template** before PR C starts.

## PR C: content (spec steps 4 to 6)

This may be split into one PR per task if a single PR gets too big to review. Every task works from the manifest rows and sets them to `done` or `kept`, and ends with `node tools/docs-check/check-docs.mjs .` exiting 0.

### Task 5: `spec.html` into notes (spec step 4)

**Files:**
- Create: notes under `10-product/` (vision, users, one per feature not yet covered), `30-software/` (architecture, the engine, data and coverage, transit, Bento Man) and `60-direction/` (build order and "Still open", public parts only), as the manifest says.
- Create: `docs/bento/90-archive/spec-section-map.md`, mapping each old § to its new note.
- Create: `docs/bento/00-start/open-questions.md`, listing every place where the spec and the code disagree, with a link to the code and to the § section.

- [ ] **Step 1:** For each `spec.html` row, write or extend the destination note. Check it against the code; when they differ, note it in `open-questions.md`, not in the feature note.
- [ ] **Step 2:** Run the checker. Expected: exit 0. Then check that every § in the map points to an existing note.
- [ ] **Step 3:** Commit with `Move the design spec into vault notes`.

### Task 6: Status, setup and operations (spec step 6, first part)

**Files:**
- Modify: `docs/bento/00-start/status.md`. It becomes the one status page: built so far, verified, open. It takes `PROGRESS.md`'s current parts; its dated history goes to `90-archive/progress-history.md`.
- Create: `50-operations/{environments,local-setup,deploying}.md` from `bento/README.md` "Setup" and "Deploying"; `30-software/{commands,layout}.md` from "Commands" and "Layout"; the other `bento/README.md` sections as the manifest says.
- Create: runbooks `50-operations/supabase-region-move.md` (from `tools/tokyo-move/` usage and the 2026-11-10 to 13 move: `check.cjs` → `apply.cjs` → `copy.cjs` → Vercel env → merge → `compare.cjs`; no secrets) and `50-operations/email-smtp.md` (Gmail SMTP and its 2-Step Verification requirement; link `knowledge/lessons/2026-11-13-gmail-smtp-needs-2sv.md` as text, since the repo is outside the vault).
- Modify: `bento/README.md`, reduced to a quick start (what it is, setup in five lines, links to the operations notes).
- Modify: `docs/PROGRESS.md`, replaced by a "Moved to [status](bento/00-start/status.md)" note.

- [ ] **Step 1:** Write the notes, then trim the sources.
- [ ] **Step 2:** Run `grep -rn "PROGRESS.md" --include=*.md --include=*.ts .`, excluding `node_modules`, and update every inbound link. Expected: only the "Moved to" note and the manifest still name it.
- [ ] **Step 3:** Run the checker. Expected: exit 0. Commit with `Bring status, setup and runbooks into the vault`.

### Task 7: Design (spec step 6, second part)

**Files:**
- Create: `20-design/README.md`, linking `../../../bento/DESIGN.md` as the design system and listing the screens with their status (`current`, `exploratory`, `inspiration`).
- Move: `docs/design-references/*` → `docs/bento/20-design/inspiration/`, leaving a "Moved to" README.
- Modify: `design/README.md`. The font contradiction is resolved per the owner's answer in the manifest.

- [ ] **Step 1:** Make the changes. Mark each mock-up's status in `20-design/README.md`.
- [ ] **Step 2:** Run the checker. Expected: exit 0. Commit with `Sort the design documents`.

### Task 8: Non-functional notes (spec step 6, third part)

**Files:**
- Create `40-non-functional/{security,privacy,performance,accessibility,costs,reliability}.md`. Each has `type: non-functional` and the spec's four headings: **Target**, **How it's checked**, **Evidence**, **Known gaps**.
- Sources:
  - `bento/CLAUDE.md` invariants (security: authGate, CSP, RLS, row caps; privacy: analytics consent, account deletion, booking references; costs: spend holds and caps);
  - migration 0029;
  - the privacy copy in `bento/src/copy/en.ts`;
  - `knowledge/checklists/security.md`.
- Evidence means a test file, a migration, a log check or a PR, never "should".
- Targets must be checkable (e.g. "every user table has RLS: `get_advisors` shows no RLS warnings"). Where no number exists yet, write "Target not set" under Known gaps, never invent one.

- [ ] **Step 1:** Write the six notes.
- [ ] **Step 2:** Run the checker. Expected: exit 0. Commit with `Add the non-functional requirements`.

### Task 9: Trim `bento/CLAUDE.md` (spec step 5)

**Files:**
- Modify: `bento/CLAUDE.md`. Each section keeps its rules **with their conditions and exceptions**, each followed by a link to its note (`../docs/bento/…`); the reasons, history and examples move to those notes. The `next dev` block at the end stays unchanged.
- Modify: `bento/AGENTS.md`, replacing the `../docs/PROGRESS.md` pointer with `../docs/README.md` and `../docs/bento/00-start/status.md`. Its own rules stay.
- Modify: the manifest's "Rules in bento/CLAUDE.md" section, setting every row's "Still in CLAUDE.md" to `yes`.

- [ ] **Step 1:** Make the edits. Diff the result against the old file: every rule row in the manifest still appears with the same conditions.
- [ ] **Step 2:** Fresh-session test. From the repo root and from `bento/`, run `echo "<question>" | claude -p --model haiku` and the safe `codex exec` call (read-only snapshot, no `.env` files). Ask each to quote, **without tools**, three rules from the manifest including an exception, for example the `api_usage` exception to "deleting an account removes everything" and the upsert caveat on trip reviews. Expected: all quoted correctly, four times.
- [ ] **Step 3:** Commit with `Keep agent rules in CLAUDE.md and move their explanations to the vault`.

## PR D: checks and clean-up (spec steps 7 and 8)

### Task 10: CI, PR template, agent rules and Vercel

**Files:**
- Create: `.github/workflows/docs-check.yml`. On `pull_request` and on `push` to `main`, it runs `node --test tools/docs-check/` and `node tools/docs-check/check-docs.mjs .`, on `ubuntu-latest` with Node 24 and no `npm install`.
- Create: `.github/pull_request_template.md`, with sections Problem, Change, **Docs impact** ("Updated: `<notes>` (what changed)" / "No docs impact, because: `<reason>`") and Validation.
- Modify: the root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md`, all three identically, adding a "Bento docs" section:
  - start at `docs/README.md`;
  - before coding, list the notes the change affects;
  - update them in the same PR;
  - fill in Docs impact;
  - nothing confidential in this public repo; business material goes in `../bento-private`;
  - for "Refresh my docs" and "Publish my docs edits", follow `docs/bento/50-operations/owner-docs-sync.md`.
- Modify: `bento/CLAUDE.md`, adding the same rule in one line under "Conventions".
- Create: `docs/bento/50-operations/owner-docs-sync.md` (`type: runbook`), with exact git commands in `../sairam7775-vault`:
  - **Refresh:** `git stash push -u -m owner-refresh-<date>` → `git fetch origin` → `git merge --ff-only origin/main`, or, if `docs/owner` has unpublished commits, `git merge origin/main` (stop and report on a conflict, `git merge --abort`) → `git stash apply` (stop and report on a conflict) → drop the stash entry by its SHA.
  - **Publish:** `git diff` and `git status`, including untracked attachments, shown to the owner and checked for confidential text → `git add docs/` → commit → push `docs/owner` → open a PR → after the merge, `git fetch && git reset --hard origin/main` on `docs/owner`, only once the owner confirms there's nothing unpublished.
- Create: `docs/bento/80-checklists/monthly-docs-review.md` (`type: checklist`), covering the security, privacy, costs and operations notes, open questions, the manifest `todo` rows and broken anchors. `last_reviewed` is changed only for notes actually reviewed.
- Modify: `bento/vercel.json`, adding `"ignoreCommand": "[ -n \"$VERCEL_GIT_PREVIOUS_SHA\" ] && git diff --quiet \"$VERCEL_GIT_PREVIOUS_SHA\" HEAD -- ."` and keeping `regions`, `github` and `crons`.

Steps:
- [ ] **Step 1:** Write the files.
- [ ] **Step 2:** Run `node tools/docs-check/check-docs.mjs .`. Expected: exit 0. Then run `cmp AGENTS.md CLAUDE.md && cmp AGENTS.md GEMINI.md`. Expected: no output.
- [ ] **Step 3:** Test the ignore command locally, in `bento/`:
  - with `VERCEL_GIT_PREVIOUS_SHA` set to the commit before a docs-only commit → exit 0;
  - set to a commit before an app commit → exit 1;
  - unset → exit 1;
  - set to `0000000` → non-zero.
- [ ] **Step 4:** Commit with `Check the docs vault in CI and add the Docs impact template`, and open PR D.
- [ ] **Step 5:** On PR D, push a temporary commit with a broken link and confirm the Action fails; revert it and confirm it passes. Check that the Vercel preview for a docs-only push shows as **skipped** and that the PR's first push built.

### Task 11: Archive and remove stubs (spec step 8)

**Files:**
- Move: `docs/spec.html` → `docs/bento/90-archive/spec.html`, and `docs/superpowers/` stays, but it's linked from `90-archive/README.md` as dated designs and plans.
- Delete: the "Moved to" stubs (`docs/PROGRESS.md`, `docs/design-references/README.md`), but only once `grep -rn` finds no link to them outside the manifest.
- Modify: `bento/CLAUDE.md`, `docs/README.md` and any file still saying `spec.html` is the "source of truth", pointing them at `docs/bento/00-start/which-file-wins.md`.
- Modify: the manifest, where every row is `done` or `kept`.

- [ ] **Step 1:** Run `grep -rn "spec.html\|PROGRESS.md\|design-references" --include=*.md --include=*.ts --include=*.html .`, excluding `node_modules` and `90-archive`, and update each hit.
- [ ] **Step 2:** Run the checker. Expected: exit 0. Run `grep -c "| todo |" docs/bento/90-archive/migration-manifest.md`. Expected: `0`.
- [ ] **Step 3:** Commit with `Archive the original spec and finish the move`. Get a Codex review of PR D; the owner merges.
- [ ] **Step 4:** Run the first monthly review using the checklist. Add a lesson to `knowledge/` if the move taught something reusable.
