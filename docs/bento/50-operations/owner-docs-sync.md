---
type: runbook
status: accepted
last_reviewed: 2026-11-13
---

# Syncing the owner's docs edits

## When to use it

The owner edits the public docs in Obsidian, in their own copy of the repo: the worktree `sairam7775-vault`, on the branch `docs/owner`, with the `docs/` folder opened as the vault. That copy has **no Obsidian Git**, so nothing is published automatically. An agent runs these procedures when the owner asks:
- **"Refresh my docs":** bring the latest `main` into the owner's copy.
- **"Publish my docs edits":** turn the owner's edits into a PR.

The private vault (`bento-private`) syncs itself through Obsidian Git and isn't covered here.

## Before you start

- Work in `../sairam7775-vault` (from the main repo folder). Run `git branch --show-current` there; it must say `docs/owner`. Stop if it doesn't.
- The stash list is **shared** with every other copy and agent. Never use a bare `git stash`, `git stash pop` or `git stash drop`. Always record a stash's **SHA** and act on that.
- **Never lose the owner's edits:** keep the saved stash until the owner confirms everything is right.

## Steps: "Refresh my docs"

1. `cd ../sairam7775-vault`, then record where you start: `PRE=$(git rev-parse HEAD)`.
2. **Save unsaved edits**, if `git status --porcelain` shows anything:
   - `git stash push -u -m "owner-refresh-$(date +%Y%m%d-%H%M%S)"`
   - straight away, record its SHA: `SAVED=$(git rev-parse stash@{0})`, and check that `git log -1 --format=%gs -g stash@{0}` shows the name you just used.
3. `git fetch origin`
4. **Bring in `main`:**
   - if `git log origin/main..HEAD` is empty (nothing unpublished): `git merge --ff-only origin/main`;
   - otherwise `git merge origin/main`. **On a conflict:** `git merge --abort`, go to step 5 to put the edits back on the old state, and tell the owner which files clashed.
5. **Put the edits back** (if you saved some): `git stash apply --index $SAVED`.
   - **On a conflict:** don't leave conflict markers in a note. Restore the clean state:
     1. `git reset --hard HEAD` restores the tracked files and the index.
     2. Remove only the untracked files the stash brought back: list them with `git show --name-only --format= $SAVED^3`, and delete just those. Never run `git clean`.
     3. Check that `git status` shows no unmerged paths.

     The saved edits are still in the stash, under `$SAVED`. Tell the owner which files clashed.
6. Tell the owner it's up to date, list the notes that changed, and ask them to check their edits.
7. **Only after the owner confirms,** drop the saved stash by its SHA:
   - find its current selector: `git stash list --format='%gd %H' | grep " $SAVED$"`;
   - check that `git rev-parse <selector>` still prints `$SAVED`;
   - then `git stash drop <selector>`.

   If the SHA isn't found exactly once, leave the stash alone and say so.

### Undoing a refresh

If the owner wants the refresh undone, and the saved stash still exists:
1. If there are new edits since: save them (`git stash push -u -m "owner-after-refresh-..."`) and record their SHA.
2. `git reset --hard $PRE`
3. `git stash apply --index $SAVED` (the original edits).
4. If you saved new edits in step 1, apply those too (`git stash apply <their SHA>`), and resolve any clash with the owner.

## Steps: "Publish my docs edits"

1. `cd ../sairam7775-vault`
2. **Make sure nothing unrelated is staged:** `git diff --cached --name-only` must be empty. If it isn't, stop and ask the owner.
3. **Show the owner everything that would be published:**
   - commits on `docs/owner` not yet in `main`: `git fetch origin`, then `git log origin/main..HEAD` and `git diff origin/main...HEAD`;
   - unsaved changes: `git diff -- docs/`;
   - new files, including images in `docs/bento/_attachments/`: `git ls-files --others --exclude-standard -- docs/`. Open each one, or for an image describe it to the owner.
4. **Check for anything confidential:** business, finances, partners, pricing, personal details, keys or tokens. Anything like that belongs in `bento-private`. Ask the owner before going on if anything looks sensitive.
5. Run `node tools/docs-check/check-docs.mjs .` and fix what it reports (content changes need the owner's OK).
6. **Stage only the docs:** `git add -- docs/`. Then check:
   - `git diff --cached --name-only` lists only `docs/` paths;
   - `git diff --cached` is what the owner agreed to.
7. Commit with a short message ("Update the trip sharing note"), `git push origin docs/owner`, and open a PR from `docs/owner` to `main` with a Docs impact section.
8. **After the PR is merged,** and only once the owner confirms there's nothing else unpublished:
   - `git fetch origin`;
   - check that `git status --porcelain` is empty and `git log origin/main..HEAD` is empty (everything is merged);
   - then `git reset --hard origin/main`.

## How to check it worked

- **Refresh:** `git merge-base --is-ancestor origin/main HEAD` succeeds, and the owner confirms their edits are still there.
- **Publish:** the PR exists, it contains only `docs/` files, and its docs check passes.

## How to undo it

- **Refresh:** see "Undoing a refresh" above.
- **Publish:** close the PR; the commit stays on `docs/owner`.
