import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseFrontmatter,
  checkNote,
  checkAgentCopies,
  collectNotes,
} from "./check-docs.mjs";

// A throwaway repo: { "relative/path": "content" }.
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-check-"));
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return root;
}

const FEATURE = "---\ntype: feature\nstatus: accepted\nimplementation: shipped\n---\n";
const NOTE = "docs/bento/10-product/a.md";

function check(files, file = NOTE) {
  const root = repo(files);
  return checkNote(file, fs.readFileSync(path.join(root, file), "utf8"), root);
}
const rules = (problems) => problems.map((p) => p.rule);

test("passes a note with valid properties and links", () => {
  const problems = check({
    [NOTE]: FEATURE + "See [other](../other.md).\n",
    "docs/bento/other.md": "x",
  });
  assert.deepEqual(problems, []);
});

test("fails a broken link", () => {
  assert.deepEqual(rules(check({ [NOTE]: FEATURE + "[gone](missing.md)\n" })), ["link"]);
});

test("fails a link whose case differs", () => {
  const problems = check({
    [NOTE]: FEATURE + "[pilot](Trip-Sharing.md)\n",
    "docs/bento/10-product/trip-sharing.md": "x",
  });
  assert.deepEqual(rules(problems), ["link"]);
});

test("resolves percent-encoded links", () => {
  const problems = check({
    [NOTE]: FEATURE + "[spaced](my%20note.md) and [angled](<my note.md>)\n",
    "docs/bento/10-product/my note.md": "x",
  });
  assert.deepEqual(problems, []);
});

test("ignores links in code", () => {
  const body = "```md\n[gone](missing.md)\n```\nInline `[gone](missing.md)` too.\n";
  assert.deepEqual(check({ [NOTE]: FEATURE + body }), []);
});

test("ignores external and anchor links", () => {
  const body = "[a](https://x.test) [b](mailto:a@b.test) [c](#section) [d](http://y.test/z.md)\n";
  assert.deepEqual(check({ [NOTE]: FEATURE + body }), []);
});

test("strips anchors before checking a link", () => {
  const problems = check({
    [NOTE]: FEATURE + "[part](other.md#heading)\n",
    "docs/bento/10-product/other.md": "x",
  });
  assert.deepEqual(problems, []);
});

test("checks image links", () => {
  assert.deepEqual(rules(check({ [NOTE]: FEATURE + "![shot](../_attachments/nope.png)\n" })), ["link"]);
});

test("fails a missing type", () => {
  const problems = check({ [NOTE]: "---\nstatus: accepted\n---\n" });
  assert.ok(rules(problems).includes("property"));
});

test("fails a note with no properties", () => {
  assert.deepEqual(rules(check({ [NOTE]: "# Just text\n" })), ["property"]);
});

test("fails an unknown status value", () => {
  const problems = check({ [NOTE]: "---\ntype: overview\nstatus: done\n---\n" });
  assert.deepEqual(rules(problems), ["property"]);
});

test("fails a feature without implementation", () => {
  const problems = check({ [NOTE]: "---\ntype: feature\nstatus: accepted\n---\n" });
  assert.deepEqual(rules(problems), ["property"]);
});

test("fails a non-functional note without implementation", () => {
  const problems = check({ [NOTE]: "---\ntype: non-functional\nstatus: draft\n---\n" });
  assert.deepEqual(rules(problems), ["property"]);
});

test("accepts an overview without implementation", () => {
  assert.deepEqual(check({ [NOTE]: "---\ntype: overview\nstatus: accepted\n---\n" }), []);
});

test("fails a missing code path", () => {
  const problems = check({ [NOTE]: FEATURE.replace("---\n", "---\ncode: [bento/src/nope.ts]\n") });
  assert.deepEqual(rules(problems), ["code-path"]);
});

test("accepts a code folder and a block list", () => {
  const head = "---\ntype: feature\nstatus: accepted\nimplementation: shipped\ncode:\n  - bento/src/lib/\n  - bento/x.ts\n---\n";
  const problems = check({ [NOTE]: head, "bento/src/lib/y.ts": "", "bento/x.ts": "" });
  assert.deepEqual(problems, []);
});

test("checks only links in the archive", () => {
  const file = "docs/bento/90-archive/old.md";
  assert.deepEqual(check({ [file]: "No properties, [ok](kept.md)\n", "docs/bento/90-archive/kept.md": "x" }, file), []);
  assert.deepEqual(rules(check({ [file]: "[gone](missing.md)\n" }, file)), ["link"]);
});

test("skips templates and attachments", () => {
  const root = repo({
    "docs/README.md": "x",
    "docs/bento/10-product/a.md": "x",
    "docs/bento/_templates/feature.md": "x",
    "docs/bento/_attachments/note.md": "x",
    "docs/superpowers/specs/s.md": "x",
  });
  assert.deepEqual(collectNotes(root).sort(), ["docs/README.md", "docs/bento/10-product/a.md"]);
});

test("parses frontmatter with CRLF", () => {
  const fm = parseFrontmatter("---\r\ntype: feature\r\ncode:\r\n  - a/b\r\n---\r\nBody\r\n");
  assert.equal(fm.data.type, "feature");
  assert.deepEqual(fm.data.code, ["a/b"]);
});

test("parses frontmatter after a BOM", () => {
  assert.equal(parseFrontmatter("﻿---\ntype: feature\n---\n").data.type, "feature");
});

test("parses inline lists and quoted values", () => {
  const fm = parseFrontmatter('---\ncode: [a/b, "c/d"]\nstatus: "accepted"\n---\n');
  assert.deepEqual(fm.data.code, ["a/b", "c/d"]);
  assert.equal(fm.data.status, "accepted");
});

test("returns null without frontmatter", () => {
  assert.equal(parseFrontmatter("# Title\n"), null);
});

test("fails when agent copies differ", () => {
  const same = repo({ "AGENTS.md": "x", "CLAUDE.md": "x", "GEMINI.md": "x" });
  assert.deepEqual(checkAgentCopies(same), []);
  const differ = repo({ "AGENTS.md": "x", "CLAUDE.md": "x", "GEMINI.md": "y" });
  assert.deepEqual(rules(checkAgentCopies(differ)), ["agent-copies"]);
});

// --- PR #67 review (Codex A4–A7) ---

test("checks links with single-quoted and parenthesised titles", () => {
  const body = "[a](missing1.md 'Title') [b](missing2.md (Title)) [c](missing3.md \"Title\")\n";
  assert.deepEqual(rules(check({ [NOTE]: FEATURE + body })), ["link", "link", "link"]);
});

test("accepts a file name with balanced parentheses", () => {
  const problems = check({
    [NOTE]: FEATURE + "[p](file(name).md)\n",
    "docs/bento/10-product/file(name).md": "x",
  });
  assert.deepEqual(problems, []);
});

test("checks reference-style link definitions", () => {
  const body = "See [the note][ref].\n\n[ref]: missing.md \"Title\"\n";
  assert.deepEqual(rules(check({ [NOTE]: FEATURE + body })), ["link"]);
});

test("a longer fence is not closed by a shorter one inside it", () => {
  const body = "````md\n```\n[gone](missing.md)\n```\n````\n[real](also-missing.md)\n";
  const problems = check({ [NOTE]: FEATURE + body });
  assert.deepEqual(problems.map((p) => p.message.split(" ")[0]), ["also-missing.md"]);
});

test("reads a block list whose items are not indented", () => {
  const fm = parseFrontmatter("---\ncode:\n- a/b\n- c/d\n---\n");
  assert.deepEqual(fm.data.code, ["a/b", "c/d"]);
});

test("ignores a comment after a value", () => {
  assert.equal(parseFrontmatter("---\ntype: overview # the start page\n---\n").data.type, "overview");
});

test("only an exact --- line closes the properties", () => {
  const fm = parseFrontmatter("---\ntype: overview\n----\nstatus: accepted\n---\n");
  assert.equal(fm.data.status, "accepted");
});

test("checks a link in the supersedes property", () => {
  const head = "---\ntype: decision\nstatus: accepted\nsupersedes: old-decision.md\n---\n";
  assert.deepEqual(rules(check({ [NOTE]: head })), ["link"]);
});

test("a link must point at a file, not a folder", () => {
  const problems = check({ [NOTE]: FEATURE + "[dir](sub/)\n", "docs/bento/10-product/sub/x.md": "x" });
  assert.deepEqual(rules(problems), ["link"]);
});

test("fails a dangling symlink", (t) => {
  const root = repo({ [NOTE]: FEATURE + "[s](link.md)\n" });
  try {
    fs.symlinkSync(path.join(root, "nowhere.md"), path.join(root, "docs/bento/10-product/link.md"));
  } catch {
    t.skip("symlinks not permitted here");
    return;
  }
  const problems = checkNote(NOTE, fs.readFileSync(path.join(root, NOTE), "utf8"), root);
  assert.deepEqual(rules(problems), ["link"]);
});
