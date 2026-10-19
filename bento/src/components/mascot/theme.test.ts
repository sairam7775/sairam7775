import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIGURES } from "./moods";
import { THEMED_ROLES, type ThemedRole } from "./types";

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

describe("Bento Man's theme colours", () => {
  it("has a globals.css rule for every themed fill and stroke the art uses", () => {
    const used = new Set<string>();
    for (const f of Object.values(FIGURES))
      for (const p of f.parts)
        for (const s of p.shapes) {
          if (s.fill && THEMED_ROLES.includes(s.fill as ThemedRole)) used.add(`bm-f-${s.fill}`);
          if (s.stroke && THEMED_ROLES.includes(s.stroke as ThemedRole)) used.add(`bm-s-${s.stroke}`);
        }
    for (const cls of used) expect(css, cls).toContain(`.mascot .${cls},`);
  });

  it("gives every themed role a dark value in both dark blocks", () => {
    for (const role of THEMED_ROLES) expect(css.split(`--color-mascot-${role}:`).length - 1, role).toBe(3);
  });
});
