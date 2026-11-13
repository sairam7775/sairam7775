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

/** Strips a trailing " # comment" from an unquoted value. */
const uncomment = (s) => (/^\s*["']/.test(s) ? s : s.replace(/\s+#.*$/, ""));

/**
 * YAML-ish frontmatter: `key: value`, `key: [a, b]`, and `key:` followed by `- item` lines
 * (indented or not). Comments after values are ignored. Only an exact `---` line closes it.
 */
export function parseFrontmatter(text) {
  const all = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (all[0] !== "---") return null;
  const close = all.indexOf("---", 1);
  if (close === -1) return null;
  const data = {};
  let listKey = null;
  for (const line of all.slice(1, close)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(unquote(uncomment(item[1])));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key] = kv;
    const raw = uncomment(kv[2]).trim();
    listKey = null;
    if (raw === "") {
      data[key] = [];
      listKey = key;
    } else if (/^\[.*\]$/.test(raw)) {
      const inner = raw.slice(1, -1).trim();
      data[key] = inner ? inner.split(",").map(unquote) : [];
    } else {
      data[key] = unquote(raw);
    }
  }
  return { data, body: all.slice(close + 1).join("\n") };
}

/** Lines outside fenced code, with inline code spans removed. A fence closes only on the same character, at least as long. */
function proseLines(body) {
  const out = [];
  let fence = null;
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const f = line.match(/^ {0,3}(\x60{3,}|~{3,})/);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    out.push(line.replace(/(\x60+)[\s\S]*?\1/g, ""));
  }
  return out;
}

/** The destination of an inline link starting at text[i] (just after "("): <...>, or balanced parentheses until a space or ")". */
function readDestination(text, i) {
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] === "<") {
    const close = text.indexOf(">", i);
    return close === -1 ? null : text.slice(i + 1, close);
  }
  let depth = 0;
  let j = i;
  for (; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") { j++; continue; }
    if (c === "(") depth++;
    else if (c === ")") { if (depth === 0) break; depth--; }
    else if (c === " " || c === "\t" || c === "\n") break;
  }
  return text.slice(i, j).replace(/\\(.)/g, "$1");
}

function normaliseTarget(target) {
  if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return null;
  let t = target.replace(/[#?].*$/, "");
  if (!t) return null;
  try {
    t = decodeURIComponent(t);
  } catch {
    /* keep as written */
  }
  return t;
}

/** Targets of inline links and images, and of reference definitions, outside code; external and anchor-only links skipped. */
export function extractLinks(body) {
  const lines = proseLines(body);
  const text = lines.join("\n");
  const out = [];
  for (let i = text.indexOf("]("); i !== -1; i = text.indexOf("](", i + 2)) {
    const t = normaliseTarget(readDestination(text, i + 2));
    if (t) out.push(t);
  }
  for (const line of lines) {
    const def = line.match(/^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/);
    if (def) {
      const t = normaliseTarget(def[1].replace(/^<|>$/g, ""));
      if (t) out.push(t);
    }
  }
  return out;
}

/** "file", "dir", or null. Every path segment must exist with exactly this case; symlinks must resolve inside the repo. */
function kindExact(repoRoot, rel) {
  let dir = repoRoot;
  for (const seg of rel.split("/").filter(Boolean)) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      return null;
    }
    if (!names.includes(seg)) return null;
    dir = path.join(dir, seg);
  }
  try {
    const real = fs.realpathSync(dir);
    const inside = path.relative(fs.realpathSync(repoRoot), real);
    if (inside.startsWith("..") || path.isAbsolute(inside)) return null;
    const st = fs.statSync(real);
    return st.isFile() ? "file" : st.isDirectory() ? "dir" : null;
  } catch {
    return null;
  }
}

const toPosix = (p) => p.split(path.sep).join("/");

/** Problems in one note. `file` is repo-relative with forward slashes. */
export function checkNote(file, text, repoRoot) {
  const problems = [];
  const add = (rule, message) => problems.push({ file, rule, message });
  const fm = parseFrontmatter(text);
  const body = fm ? fm.body : text.replace(/^\uFEFF/, "");

  const supersedes = fm && typeof fm.data.supersedes === "string" && fm.data.supersedes ? fm.data.supersedes : null;
  const fromProperty = supersedes ? (supersedes.includes("](") ? extractLinks(supersedes) : [normaliseTarget(supersedes)].filter(Boolean)) : [];
  for (const target of [...fromProperty, ...extractLinks(body)]) {
    const rel = toPosix(path.relative(repoRoot, path.resolve(repoRoot, path.dirname(file), target)));
    if (rel.startsWith("..") || path.isAbsolute(rel)) add("link", `${target} points outside the repo`);
    else if (kindExact(repoRoot, rel) !== "file") add("link", `${target} not found as a file (check the name and its case)`);
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
    } else if (!kindExact(repoRoot, clean)) {
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
