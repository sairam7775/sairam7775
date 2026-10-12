import { describe, expect, it } from "vitest";
import { conversation } from "../chat";

const u = (content: string) => ({ role: "user" as const, content });
const a = (content: string) => ({ role: "assistant" as const, content });

describe("conversation", () => {
  it("starts with the traveller, dropping assistant turns before the first one", () => {
    const m = conversation([a("Here is a re-planned Tuesday."), u("thanks"), a("ok")], "now?");
    expect(m.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
    expect(m[0].content).toBe("thanks");
  });
  it("merges same-role neighbours, so a failed turn's message isn't lost or doubled", () => {
    const m = conversation([u("plan Kyoto"), u("plan Kyoto please"), a("Here."), a("Also this.")], "next");
    expect(m).toEqual([
      { role: "user", content: "plan Kyoto\n\nplan Kyoto please" },
      { role: "assistant", content: "Here.\n\nAlso this." },
      { role: "user", content: "next" },
    ]);
  });
  it("always ends on this turn's message", () => {
    expect(conversation([], "hello")).toEqual([{ role: "user", content: "hello" }]);
    expect(conversation([u("earlier")], "hello").at(-1)).toEqual({ role: "user", content: "earlier\n\nhello" });
  });
});
