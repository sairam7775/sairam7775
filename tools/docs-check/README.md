# Docs check

Checks Bento's documentation vault (`docs/`). It needs Node only, with no packages to install.

```
node tools/docs-check/check-docs.mjs          # check the repo
node --test tools/docs-check/*.test.mjs      # test the checker
```

**Notes checked:** `docs/README.md` and `docs/bento/**/*.md`, except `_templates/`, `_attachments/` and `.obsidian/`.

| Rule | Fails when |
|---|---|
| `link` | A relative link (or image) points at a file that doesn't exist, or whose name differs in case, or points outside the repo. Links inside code, external links and `#anchor` links are skipped; anchors aren't checked yet |
| `property` | A note has no properties block, or `type` / `status` / `implementation` is missing or not an allowed value. `implementation` is required for `feature` and `non-functional` notes. Notes in `90-archive/` are checked for links only |
| `code-path` | A path in `code` isn't repo-relative, or no longer exists. A rename should fail here: update the note |
| `agent-copies` | The root `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` aren't byte-identical |

The allowed values are in the design: `docs/superpowers/specs/2026-11-13-bento-docs-vault-design.md`.
