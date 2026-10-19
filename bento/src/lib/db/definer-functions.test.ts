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
  const statement = /^[ \t]*(?:create\s+(?:or\s+replace\s+)?function\b[\s\S]*?\bas\s+(\$(?:[a-z_][a-z0-9_]*)?\$)[\s\S]*?\1\s*;|alter\s+function\b[^;]*;)/gim;
  const statements = [...sql.matchAll(statement)].map(([text]) => text.trim());
  const functionCommands = [...sql.matchAll(/^[ \t]*(?:create\s+(?:or\s+replace\s+)?|alter\s+)function\b/gim)].length;
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

function functionName(rawName: string): string {
  const parts = rawName
    .replace(/"/g, "")
    .split(".")
    .map((part) => part.trim().toLowerCase());
  return parts.length === 1 ? `public.${parts[0]}` : parts.join(".");
}

function configuredSearchPath(header: string): string | null {
  const withoutComments = header
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
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
): (Pick<FunctionState, "name" | "argumentTypes"> & { searchPath?: string; securityDefiner?: boolean }) | null {
  const alter = /^alter\s+function\s+((?:"[^"]+"|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|[\w$]+))?)\s*\(([\s\S]*)\)\s*(.*);$/i.exec(
    statement,
  );
  if (!alter) return null;

  // An ALTER can change the search path, the security mode, or both: a
  // function made SECURITY DEFINER later needs a safe path just the same.
  const searchPath = configuredSearchPath(alter[3]);
  const mode = /\bsecurity\s+(definer|invoker)\b/i.exec(alter[3])?.[1].toLowerCase();
  if (searchPath === null && !mode) return null;
  return {
    name: functionName(alter[1]),
    argumentTypes: splitArguments(alter[2]).map(normalizeType),
    ...(searchPath !== null ? { searchPath } : {}),
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
  const entries = unquoted.split(",").map((entry) => entry.trim().replace(/^"|"$/g, ""));
  return entries.at(-1)?.toLowerCase() === "pg_temp";
}

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

      const altered = parseAlterFunction(statement);
      if (altered) {
        const key = identity(altered);
        const existing = functions.get(key);
        if (!existing) throw new Error(`${file} alters unknown function ${key}`);
        functions.set(key, {
          ...existing,
          searchPath: altered.searchPath ?? existing.searchPath,
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
});
