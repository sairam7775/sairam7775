import { describe, expect, it } from "vitest";
import { copy, type Copy } from ".";

/** Every line, with sample values filled in for the functions. */
function lines(node: unknown, path: string[] = []): [string, string][] {
  if (typeof node === "string") return [[path.join("."), node]];
  if (node === null) return []; // a deliberately absent line, e.g. a stop with no note
  if (typeof node === "function") {
    const args = Array.from({ length: node.length }, (_, i) => (i === 0 ? "X" : 2));
    return [[path.join("."), String((node as (...a: unknown[]) => unknown)(...args))]];
  }
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => lines(v, [...path, k]));
  throw new Error(`${path.join(".")} is neither text nor a group`);
}

const all = lines(copy);

describe("copy", () => {
  it("has no empty lines", () => {
    for (const [path, text] of all) expect(text.trim(), path).not.toBe("");
  });

  it("keeps internal words off the page", () => {
    // Words from the code and the database that mean nothing to a traveller.
    const jargon = /\b(stub|tier|null|undefined|supabase|RLS|proposal_id|draft|engine|graph)\b|\b\d+n\b/i;
    for (const [path, text] of all) {
      // The privacy page must name the companies that handle data, Supabase among them.
      const checked = path.startsWith("privacy.") ? text.replace(/\bSupabase\b/g, "") : text;
      expect(checked, path).not.toMatch(jargon);
    }
  });

  it("makes another language list every line (a type check)", () => {
    // @ts-expect-error: a language missing the Supabase messages must not compile.
    const partial: Copy = { ...copy, auth: { ...copy.auth, supabase: {} } };
    // @ts-expect-error: nor one that leaves out a home-page step.
    const fewer: Copy = { ...copy, home: { ...copy.home, how: { ...copy.home.how, steps: { tell: copy.home.how.steps.tell } } } };
    expect(partial && fewer).toBeDefined();
  });

  it("fills in what it's given", () => {
    expect(copy.tour.stepOf(2, 5)).toBe("Step 2 of 5");
    expect(copy.db.failed("save the trip")).toBe("Couldn't save the trip. Try again in a moment.");
  });
});
