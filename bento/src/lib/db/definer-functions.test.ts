import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type FunctionState = {
  name: string;
  argumentTypes: string[];
  securityDefiner: boolean;
  searchPath: string | null;
  migration: string;
};

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");

// Current migrations put each function body in a dollar-quoted string and
// put ALTER FUNCTION clauses on one statement. Match those statements without
// splitting on semicolons inside the bodies.
function migrationFunctionStatements(sql: string): string[] {
  const statement = /^[ \t]*(?:create\s+(?:or\s+replace\s+)?(?:function|procedure)\b[\s\S]*?\bas\s+(\$(?:[a-z_][a-z0-9_]*)?\$)[\s\S]*?\1\s*;|alter\s+(?:function|routine|procedure)\b[^;]*;)/gim;
  const statements = [...sql.matchAll(statement)].map(([text]) => text.trim());
  const functionCommands = [...sql.matchAll(/^[ \t]*(?:create\s+(?:or\s+replace\s+)?(?:function|procedure)|alter\s+(?:function|routine|procedure))\b/gim)].length;
  if (statements.length !== functionCommands) {
    throw new Error("could not read every CREATE or ALTER FUNCTION statement");
  }
  return statements;
}

function splitArguments(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (source[index] === "," && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = source.slice(start).trim();
  if (last) args.push(last);
  return args;
}

function normalizeType(type: string): string {
  const normalized = type.toLowerCase().replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = {
    int: "integer",
    int2: "smallint",
    int4: "integer",
    int8: "bigint",
    bool: "boolean",
    decimal: "numeric",
  };
  return aliases[normalized] ?? normalized;
}

// Unquoted names fold to lower case; a quoted one keeps its case (and its
// quotes, unless it is all lower case anyway), as PostgreSQL treats them.
function functionName(rawName: string): string {
  const parts = rawName.split(".").map((part) => {
    const trimmed = part.trim();
    if (!trimmed.startsWith('"')) return trimmed.toLowerCase();
    const inner = trimmed.slice(1, -1);
    return inner === inner.toLowerCase() ? inner : trimmed;
  });
  return parts.length === 1 ? `public.${parts[0]}` : parts.join(".");
}

const withoutSqlComments = (sql: string) => sql.replace(/--[^\r\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

function configuredSearchPath(header: string): string | null {
  const withoutComments = header
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  // FROM CURRENT takes whatever path the migration ran with, which can't be
  // checked here, so it is kept as written and counts as unsafe.
  if (/\bset\s+search_path\s+from\s+current\b/i.test(withoutComments)) return "from current";
  const match = /\bset\s+search_path\s*(?:=|to)\s*([\s\S]*?)(?=\s+\bset\s+[\w]+\s*(?:=|to)(?:\s|$)|$)/i.exec(
    withoutComments,
  );
  return match?.[1].trim().replace(/;\s*$/, "") ?? null;
}

function parseCreateFunction(statement: string): FunctionState | null {
  const create = /^create\s+(?:or\s+replace\s+)?function\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)\s*\(([\s\S]*?)\)\s*returns\b([\s\S]*?)\bas\s+\$(?:[a-z_][a-z0-9_]*)?\$/i.exec(
    statement,
  );
  if (!create) return null;

  const argumentTypes = splitArguments(create[2]).map((argument) => {
    // Migration function inputs use p_* names; ALTER FUNCTION signatures use
    // types only. No current function uses OUT or default arguments.
    return normalizeType(argument.replace(/^p_[\w$]+\s+/i, ""));
  });
  const header = create[3]
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  return {
    name: functionName(create[1]),
    argumentTypes,
    securityDefiner: /\bsecurity\s+definer\b/i.test(header),
    searchPath: configuredSearchPath(header),
    migration: "",
  };
}

function parseAlterFunction(
  statement: string,
): (Pick<FunctionState, "name" | "argumentTypes"> & { searchPath?: string | null; securityDefiner?: boolean }) | null {
  const alter = /^alter\s+(?:function|routine|procedure)\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)\s*\(([\s\S]*)\)\s*(.*);$/i.exec(
    statement,
  );
  if (!alter) return null;

  // An ALTER can change the search path, the security mode, or both: a
  // function made SECURITY DEFINER later needs a safe path just the same.
  // RESET search_path (or RESET ALL) removes the path, so it reads as none.
  const action = withoutSqlComments(alter[3]);
  const searchPath = configuredSearchPath(action);
  const reset = /\breset\s+(?:search_path|all)\b/i.test(action);
  const mode = /\bsecurity\s+(definer|invoker)\b/i.exec(action)?.[1].toLowerCase();
  if (searchPath === null && !reset && !mode) return null;
  return {
    name: functionName(alter[1]),
    argumentTypes: splitArguments(alter[2]).map(normalizeType),
    ...(searchPath !== null ? { searchPath } : reset ? { searchPath: null } : {}),
    ...(mode ? { securityDefiner: mode === "definer" } : {}),
  };
}

function identity(fn: Pick<FunctionState, "name" | "argumentTypes">): string {
  return `${fn.name}(${fn.argumentTypes.join(",")})`;
}

function hasSafeSearchPath(path: string | null): boolean {
  if (path === null) return false;
  const trimmed = path.trim();
  const unquoted = trimmed.startsWith("'") && trimmed.endsWith("'")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  if (unquoted === "") return true;
  // pg_temp last, and only schemas travellers can't write to before it.
  // A quoted entry keeps its case, as PostgreSQL reads it: "PG_TEMP" isn't pg_temp.
  const entries = unquoted.split(",").map((entry) => {
    const name = entry.trim();
    return name.startsWith('"') && name.endsWith('"') ? name.slice(1, -1) : name.toLowerCase();
  });
  return entries.at(-1) === "pg_temp" && entries.slice(0, -1).every((entry) => TRUSTED_SCHEMAS.has(entry));
}

const TRUSTED_SCHEMAS = new Set(["public", "pg_catalog"]);

/** Every function as it stands after these migrations, in order. */
function functionsAfter(migrations: { file: string; sql: string }[]): Map<string, FunctionState> {
  const functions = new Map<string, FunctionState>();
  for (const { file, sql } of migrations) {
    for (const statement of migrationFunctionStatements(sql)) {
      const created = parseCreateFunction(statement);
      if (created) {
        created.migration = file;
        functions.set(identity(created), created);
        continue;
      }
      // A CREATE this can't read (OUT parameters without RETURNS, or any
      // procedure) could be an unchecked definer, so it fails rather than
      // being skipped.
      if (/^create\b/i.test(statement)) throw new Error(`${file}: could not read ${statement.split("\n")[0]}`);

      const altered = parseAlterFunction(statement);
      if (altered) {
        const key = identity(altered);
        const existing = functions.get(key);
        if (!existing) throw new Error(`${file} alters unknown function ${key}`);
        functions.set(key, {
          ...existing,
          searchPath: altered.searchPath !== undefined ? altered.searchPath : existing.searchPath,
          securityDefiner: altered.securityDefiner ?? existing.securityDefiner,
          migration: file,
        });
      }
    }
  }
  return functions;
}

const unsafeDefiners = (functions: Map<string, FunctionState>) =>
  [...functions.entries()]
    .filter(([, fn]) => fn.securityDefiner && !hasSafeSearchPath(fn.searchPath))
    .map(([signature, fn]) => `${signature} (last changed in ${fn.migration})`);

describe("SECURITY DEFINER function search paths", () => {
  it("leaves pg_temp last (or uses an empty path) after all migrations", () => {
    const files = readdirSync(migrationsDirectory)
      .filter((file) => /^\d{4}_.*\.sql$/.test(file))
      .sort((left, right) => left.localeCompare(right));
    const migrations = files.map((file) => ({ file, sql: readFileSync(join(migrationsDirectory, file), "utf8") }));
    expect(unsafeDefiners(functionsAfter(migrations))).toEqual([]);
  });

  it("catches a function made SECURITY DEFINER by a later ALTER without a safe path", () => {
    const created = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nas $$ select 1 $$;" };
    const promoted = { file: "0002_b.sql", sql: "alter function public.f(text) security definer;" };
    const fixed = { file: "0003_c.sql", sql: "alter function public.f(text) set search_path = public, pg_temp;" };
    expect(unsafeDefiners(functionsAfter([created, promoted]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
    expect(unsafeDefiners(functionsAfter([created, promoted, fixed]))).toEqual([]);
  });

  it("catches a later ALTER that resets the search path", () => {
    const created = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nsecurity definer\nset search_path = public, pg_temp\nas $$ select 1 $$;" };
    const reset = { file: "0002_b.sql", sql: "alter function public.f(text) reset search_path;" };
    const resetAll = { file: "0002_b.sql", sql: "alter function public.f(text) reset all;" };
    expect(unsafeDefiners(functionsAfter([created]))).toEqual([]);
    expect(unsafeDefiners(functionsAfter([created, reset]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
    expect(unsafeDefiners(functionsAfter([created, resetAll]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
  });

  const definer = (name: string, path: string) => ({
    file: "0001_a.sql",
    sql: `create or replace function public.${name}(p_a text)\nreturns void\nlanguage sql\nsecurity definer\nset search_path = ${path}\nas $$ select 1 $$;`,
  });

  it("allows only trusted schemas before pg_temp", () => {
    expect(unsafeDefiners(functionsAfter([definer("f", "public, pg_temp")]))).toEqual([]);
    expect(unsafeDefiners(functionsAfter([definer("f", "''")]))).toEqual([]);
    expect(unsafeDefiners(functionsAfter([definer("f", "writable, pg_temp")]))).toEqual(["public.f(text) (last changed in 0001_a.sql)"]);
    // Quoted names keep their case, so "PG_TEMP" is not the pg_temp alias.
    expect(unsafeDefiners(functionsAfter([definer("f", 'public, "PG_TEMP"')]))).toEqual(["public.f(text) (last changed in 0001_a.sql)"]);
    expect(unsafeDefiners(functionsAfter([definer("f", '"public", "pg_temp"')]))).toEqual([]);
  });

  it("reads ALTER ROUTINE like ALTER FUNCTION", () => {
    const created = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nas $$ select 1 $$;" };
    const promoted = { file: "0002_b.sql", sql: "alter routine public.f(text) security definer;" };
    const fixed = { file: "0003_c.sql", sql: "alter routine public.f(text) set search_path = public, pg_temp;" };
    expect(unsafeDefiners(functionsAfter([created, promoted]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
    expect(unsafeDefiners(functionsAfter([created, promoted, fixed]))).toEqual([]);
  });

  it("refuses procedures, which it can't check yet", () => {
    const procedure = { file: "0001_a.sql", sql: "create or replace procedure public.p(p_a text)\nlanguage sql\nsecurity definer\nas $$ select 1 $$;" };
    expect(() => functionsAfter([procedure])).toThrow("0001_a.sql");
    expect(() => functionsAfter([{ file: "0002_b.sql", sql: "alter procedure public.p(text) security definer;" }])).toThrow("0002_b.sql");
  });

  it("ignores a comment when reading an ALTER's security mode", () => {
    const created = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nas $$ select 1 $$;" };
    const promoted = { file: "0002_b.sql", sql: "alter function public.f(text) /* was security invoker */ security definer;" };
    expect(unsafeDefiners(functionsAfter([created, promoted]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
  });

  it("refuses a CREATE FUNCTION it can't read, such as one with OUT parameters and no RETURNS", () => {
    const outParams = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text, out p_b int)\nlanguage sql\nsecurity definer\nas $$ select 1 $$;" };
    expect(() => functionsAfter([outParams])).toThrow("0001_a.sql");
  });

  it("keeps a quoted mixed-case name apart from the unquoted one", () => {
    const quoted = { file: "0001_a.sql", sql: `create or replace function public."F"(p_a text)\nreturns void\nlanguage sql\nsecurity definer\nas $$ select 1 $$;` };
    expect(unsafeDefiners(functionsAfter([quoted, definer("f", "public, pg_temp")]))).toEqual(['public."F"(text) (last changed in 0001_a.sql)']);
  });

  it("treats SET search_path FROM CURRENT as unsafe, since the migration's path can't be known", () => {
    const created = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nsecurity definer\nset search_path = public, pg_temp\nas $$ select 1 $$;" };
    const fromCurrent = { file: "0002_b.sql", sql: "alter function public.f(text) set search_path from current;" };
    const createdFromCurrent = { file: "0001_a.sql", sql: "create or replace function public.f(p_a text)\nreturns void\nlanguage sql\nsecurity definer\nset search_path from current\nas $$ select 1 $$;" };
    expect(unsafeDefiners(functionsAfter([created, fromCurrent]))).toEqual(["public.f(text) (last changed in 0002_b.sql)"]);
    expect(unsafeDefiners(functionsAfter([createdFromCurrent]))).toEqual(["public.f(text) (last changed in 0001_a.sql)"]);
  });
});
