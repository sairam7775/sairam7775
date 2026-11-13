---
type: runbook
status: accepted
last_reviewed: 2026-11-13
---

# Syncing the owner's docs edits

## When to use it

The owner edits the public docs in Obsidian, in their own copy of the repo: the worktree `sairam7775-vault`, on the branch `docs/owner`, with the `docs/` folder opened as the vault. That copy has **no Obsidian Git**, so nothing is published automatically. An agent runs these two procedures when the owner asks:
- **"Refresh my docs":** bring the latest `main` into the owner's copy.
- **"Publish my docs edits":** turn the owner's edits into a PR.

The private vault (`bento-private`) syncs itself through Obsidian Git and isn't covered here.

## Before you start

- Work in `../sairam7775-vault` (from the main repo folder). Run `git -C ../sairam7775-vault branch --show-current`; it must say `docs/owner`. Stop if it doesn't.
- Never use a bare `git stash` or `git stash pop`: the stash list is shared with other copies and agents. Use a named stash and apply it by its SHA, as below.

## Steps: "Refresh my docs"

1. `cd ../sairam7775-vault`
2. If `git status --porcelain` shows anything, save it:
   - `git stash push -u -m owner-refresh-YYYYMMDD`
   - note its SHA from `git stash list --format='%H %gs'`.
3. `git fetch origin`
4. Bring in `main`:
   - if `git log origin/main..docs/owner` is empty (nothing unpublished), run `git merge --ff-only origin/main`;
   - otherwise `git merge origin/main`. **On a conflict:** `git merge --abort`, re-apply the saved edits (step 5), and tell the owner which files clashed. Never leave conflict markers in a note.
5. If you saved edits: `git stash apply <sha>`. **On a conflict:** stop, undo the failed apply with `git checkout -- .`, keep the stash, and tell the owner which files clashed. If it applied cleanly, drop that stash entry: find its current `stash@{n}` by the name first.
6. Tell the owner it's up to date, and list any notes that changed.

## Steps: "Publish my docs edits"

1. `cd ../sairam7775-vault`
2. Show the owner everything that would be published: `git status` (including new files, such as images in `docs/bento/_attachments/`) and `git diff`.
3. **Check for anything confidential:** business, finances, partners, pricing, personal details, keys or tokens. Anything like that belongs in `bento-private`. Ask the owner before going on if anything looks sensitive.
4. Run `node tools/docs-check/check-docs.mjs .` and fix what it reports (with the owner's OK for content).
5. `git add docs/`, then commit with a short message ("Update the trip sharing note").
6. `git push origin docs/owner`, then open a PR from `docs/owner` to `main` with a Docs impact section.
7. After the PR is merged, and only once the owner confirms there's nothing else unpublished:

   ```
   git fetch origin
   git reset --hard origin/main
   ```

## How to check it worked

- Refresh: `git log -1 origin/main` is an ancestor of `HEAD`, and the owner's edits are still in the files.
- Publish: the PR exists and its docs check passes.

## How to undo it

- Refresh: `git reset --hard ORIG_HEAD` undoes the merge; the saved edits are still in the stash.
- Publish: close the PR; the commit stays on `docs/owner`.
