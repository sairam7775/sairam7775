// Checks Bento's documentation vault: links, note properties, code paths and
// the root agent-file copies. Built-in modules only.
//   node tools/docs-check/check-docs.mjs [repoRoot]
// Exits 1 and prints one line per problem if anything fails, 0 otherwise.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TYPES = ["feature", "non-functional", "decision", "runbook", "checklist", "overview", "design"];
const STATUSES = ["draft", "accepted", "superseded"];
const IMPLEMENTATIONS = ["planned", "partial", "shipped", "n/a"];
const NEEDS_IMPLEMENTATION = ["feature", "non-functional"];
const ARCHIVE = "docs/bento/90-archive/";
const SKIPPED = ["_templates", "_attachments", ".obsidian"];
const AGENT_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"];

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

/** YAML-ish frontmatter: `key: value`, `key: [a, b]`, and `key:` followed by `  - item` lines. */
export function parseFrontmatter(text) {
  const t = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!t.startsWith("---\n")) return null;
  const end = t.indexOf("\n---", 3);
  if (end === -1) return null;
  const lines = t.slice(4, end).split("\n");
  const data = {};
  let listKey = null;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    listKey = null;
    if (raw === "") {
      data[key] = [];
      listKey = key;
    } else if (/^\[.*\]$/.test(raw.trim())) {
      const inner = raw.trim().slice(1, -1).trim();
      data[key] = inner ? inner.split(",").map(unquote) : [];
    } else {
      data[key] = unquote(raw);
    }
  }
  const body = t.slice(t.indexOf("\n", end + 1) + 1);
  return { data, body };
}

/** Targets of [..](..) and ![..](..), outside code, without external, anchor-only, anchor or query parts. */
export function extractLinks(body) {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let fence = null;
  const kept = [];
  for (const line of lines) {
    const f = line.match(/^\s*(```|~~~)/);
    if (f) {
      fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
      continue;
    }
    if (!fence) kept.push(line.replace(/`[^`]*`/g, ""));
  }
  const out = [];
  const re = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  for (const m of kept.join("\n").matchAll(re)) {
    let target = m[1].replace(/^<|>$/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    target = target.replace(/[#?].*$/, "");
    if (!target) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      /* keep as written */
    }
    out.push(target);
  }
  return out;
}

/** True only if every path segment exists with exactly this case. */
function existsExact(repoRoot, rel) {
  let dir = repoRoot;
  for (const seg of rel.split("/").filter(Boolean)) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      return false;
    }
    if (!names.includes(seg)) return false;
    dir = path.join(dir, seg);
  }
  return true;
}

const toPosix = (p) => p.split(path.sep).join("/");

/** Problems in one note. `file` is repo-relative with forward slashes. */
export function checkNote(file, text, repoRoot) {
  const problems = [];
  const add = (rule, message) => problems.push({ file, rule, message });
  const fm = parseFrontmatter(text);
  const body = fm ? fm.body : text.replace(/^﻿/, "");

  for (const target of extractLinks(body)) {
    const rel = toPosix(path.relative(repoRoot, path.resolve(repoRoot, path.dirname(file), target)));
    if (rel.startsWith("..") || path.isAbsolute(rel)) add("link", `${target} points outside the repo`);
    else if (!existsExact(repoRoot, rel)) add("link", `${target} not found (check the name and its case)`);
  }

  if (file.startsWith(ARCHIVE)) return problems;

  if (!fm) {
    add("property", "no properties block (--- type/status ---) at the top");
    return problems;
  }
  const { type, status, implementation, code } = fm.data;
  if (!TYPES.includes(type)) add("property", `type must be one of ${TYPES.join(", ")} (got ${type ?? "nothing"})`);
  if (!STATUSES.includes(status)) add("property", `status must be one of ${STATUSES.join(", ")} (got ${status ?? "nothing"})`);
  if (implementation !== undefined && !IMPLEMENTATIONS.includes(implementation)) {
    add("property", `implementation must be one of ${IMPLEMENTATIONS.join(", ")} (got ${implementation})`);
  } else if (implementation === undefined && NEEDS_IMPLEMENTATION.includes(type)) {
    add("property", `a ${type} note needs implementation: ${IMPLEMENTATIONS.join(" / ")}`);
  }
  for (const p of code === undefined ? [] : [].concat(code)) {
    const clean = p.replace(/\/+$/, "");
    if (!clean || clean.startsWith("/") || clean.startsWith("..") || /^[A-Za-z]:/.test(clean)) {
      add("code-path", `${p} must be repo-relative`);
    } else if (!existsExact(repoRoot, clean)) {
      add("code-path", `${p} not found (renamed? update this note)`);
    }
  }
  return problems;
}

/** The root AGENTS.md, CLAUDE.md and GEMINI.md must be byte-identical. */
export function checkAgentCopies(repoRoot) {
  const texts = AGENT_FILES.map((f) => {
    const full = path.join(repoRoot, f);
    return fs.existsSync(full) ? fs.readFileSync(full) : null;
  });
  if (texts.some((t) => t === null)) {
    return [{ file: AGENT_FILES.join(", "), rule: "agent-copies", message: "one of the three root agent files is missing" }];
  }
  if (texts.every((t) => t.equals(texts[0]))) return [];
  return [{ file: AGENT_FILES.join(", "), rule: "agent-copies", message: "the three root agent files differ; edit all three together" }];
}

/** docs/README.md plus docs/bento/**\/*.md, without templates, attachments or Obsidian settings. */
export function collectNotes(repoRoot) {
  const out = [];
  if (fs.existsSync(path.join(repoRoot, "docs/README.md"))) out.push("docs/README.md");
  const walk = (rel) => {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED.includes(entry.name)) walk(child);
      } else if (entry.name.endsWith(".md")) {
        out.push(child);
      }
    }
  };
  walk("docs/bento");
  return out;
}

export function run(repoRoot) {
  const problems = [
    ...collectNotes(repoRoot).flatMap((f) => checkNote(f, fs.readFileSync(path.join(repoRoot, f), "utf8"), repoRoot)),
    ...checkAgentCopies(repoRoot),
  ];
  for (const p of problems) console.log(`${p.file}: [${p.rule}] ${p.message}`);
  console.log(problems.length ? `\n${problems.length} problem(s).` : "Docs check passed.");
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = run(path.resolve(process.argv[2] ?? "."));
}
