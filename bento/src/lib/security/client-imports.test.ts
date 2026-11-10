import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Zod checks whether it may compile code by calling Function(""), which the
 *  enforced CSP blocks and reports from every page that loads it. Zod is
 *  for the server (actions, routes); browser code must not pull it in, not
 *  even through a shared module for one small helper. Read with TypeScript's
 *  own parser, so quoting, comments, re-exports and import() all count. */
const SRC = resolve(__dirname, "../..");

const parse = (source: string, file = "module.tsx") => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);

/** The module's directives ("use client", "use server"): its leading string statements. */
function directives(sf: ts.SourceFile): string[] {
  const found: string[] = [];
  for (const statement of sf.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    found.push(statement.expression.text);
  }
  return found;
}

/** Modules that reach the bundle. Type-only imports and exports are erased
 *  (`import type`, or every named binding marked `type`). */
function runtimeImports(sf: ts.SourceFile): string[] {
  const specs: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : null;
      const typeOnly = clause?.isTypeOnly || (!!clause && !clause.name && !!named && named.length > 0 && named.every((e) => e.isTypeOnly));
      if (!typeOnly) specs.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const named = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : null;
      const typeOnly = node.isTypeOnly || (!!named && named.length > 0 && named.every((e) => e.isTypeOnly));
      if (!typeOnly) specs.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) specs.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
}

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  const candidates = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, `index${e}`))];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}

/** The chain of files from `start` to one importing zod, or null. */
function pathToZod(start: string, seen = new Set<string>()): string[] | null {
  if (seen.has(start)) return null;
  seen.add(start);
  const sf = parse(readFileSync(start, "utf8"), start);
  // A server action module reaches the browser only as a reference to call.
  if (directives(sf).includes("use server")) return null;
  for (const spec of runtimeImports(sf)) {
    if (spec === "zod" || spec.startsWith("zod/")) return [start];
    const next = resolveImport(start, spec);
    const chain = next && pathToZod(next, seen);
    if (chain) return [start, ...chain];
  }
  return null;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|jsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("reading a module's imports", () => {
  it("counts every way a module can be pulled in", () => {
    const sf = parse(`
      import a from 'single';
      import { b } from "double";
      import * as c from "star";
      import "side-effect";
      export { d } from "re-export";
      export * from "export-all";
      const e = () => import("dynamic");
    `);
    expect(runtimeImports(sf).sort()).toEqual(["double", "dynamic", "export-all", "re-export", "side-effect", "single", "star"]);
  });

  it("leaves out what compiles away", () => {
    const sf = parse(`
      import type { A } from "type-import";
      import { type B, type C } from "inline-types";
      export type { D } from "type-export";
      import { type E, f } from "mixed";
    `);
    expect(runtimeImports(sf)).toEqual(["mixed"]);
  });

  it("finds a directive after a comment, and not one further down", () => {
    expect(directives(parse(`// A note first.\n/* and another */\n"use client";\nimport x from "y";`))).toEqual(["use client"]);
    expect(directives(parse(`import x from "y";\n"use client";`))).toEqual([]);
  });
});

describe("browser code", () => {
  it("never pulls in zod", () => {
    const clientFiles = files(SRC).filter((f) => directives(parse(readFileSync(f, "utf8"), f)).includes("use client"));
    expect(clientFiles.length).toBeGreaterThan(10);
    const offenders = clientFiles.map((f) => pathToZod(f)).filter((c): c is string[] => c !== null);
    expect(offenders.map((chain) => chain.map((f) => relative(SRC, f).replace(/\\/g, "/")).join(" → "))).toEqual([]);
  });
});
