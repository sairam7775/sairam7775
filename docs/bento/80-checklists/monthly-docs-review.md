---
type: checklist
status: accepted
last_reviewed: 2026-11-13
---

# Monthly docs review

Once a month, by the owner or an agent. It's focused on the notes where being out of date is risky. Change a note's `last_reviewed` only if you actually reviewed it.

- [ ] **Security** ([security](../40-non-functional/security.md)): do the targets still match the code? Any new form that checks a password or code without `authGate`? Supabase security advisors: any new findings?
- [ ] **Privacy** ([privacy](../40-non-functional/privacy.md)): has Bento started collecting something, or using a new company that handles data, without a line on the privacy page? Is the "where data lives" wording still true?
- [ ] **Costs** ([costs](../40-non-functional/costs.md)): is the price table in `cost.ts` current? Is the spending cap still right?
- [ ] **Operations** ([environments](../50-operations/environments.md), [deploying](../50-operations/deploying.md)): do the environments, variables and Supabase settings match reality?
- [ ] **Status** ([status](../00-start/status.md)): is what's built and what's open still true?
- [ ] **Open questions** ([open questions](../00-start/open-questions.md)): can any be decided, or are any now built?
- [ ] **Migration manifest** ([manifest](../90-archive/migration-manifest.md)): any rows still `todo`?
- [ ] **Links into headings** (`#section`): the checker doesn't check these yet, so spot-check the most used ones.
- [ ] **The checker** (`node tools/docs-check/check-docs.mjs`) passes on `main`.

Record anything you fixed in the PR that fixes it, and anything reusable as a lesson in the shared knowledge base.
