import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewNote } from "@/lib/places/review-notes";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(),
  revalidatePath: vi.fn(), requireAdmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));

import { settleReviewNote } from "../admin/actions";
import { ReviewNotes } from "../admin/review-notes";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ is: mocks.is });
  mocks.is.mockReturnValue({ select: mocks.select });
  mocks.select.mockResolvedValue({ data: [{ id: 7 }], error: null });
  mocks.requireAdmin.mockResolvedValue({ user: { id: "u1", email: "owner@example.com" }, db: { from: mocks.from } });
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const settle = (fields: Record<string, string>) => settleReviewNote(form(fields)).then(() => "no redirect", (e: Error) => e.message);

describe("settleReviewNote", () => {
  it("settles an open note with the admin's call and goes back", async () => {
    const to = await settle({ id: "7", decision: "  Keep 18:00, summer hours in the tip.  ", back: "/admin/review?notes=1" });
    expect(to).toBe("redirect:/admin/review?notes=1&settled=1");
    expect(mocks.from).toHaveBeenCalledWith("place_review_notes");
    const written = mocks.update.mock.calls[0][0];
    expect(written).toMatchObject({ decision: "Keep 18:00, summer hours in the tip.", settled_by: "owner@example.com" });
    expect(Date.parse(written.settled_at)).not.toBeNaN();
    expect(mocks.eq).toHaveBeenCalledWith("id", 7);
    expect(mocks.is).toHaveBeenCalledWith("settled_at", null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/review");
  });

  it("stores no decision when the box is left empty", async () => {
    await settle({ id: "7", decision: " ", back: "/admin/places/kyt-kiyomizu" });
    expect(mocks.update.mock.calls[0][0].decision).toBeNull();
  });

  it("only goes back inside the admin pages", async () => {
    expect(await settle({ id: "7", back: "https://evil.example/" })).toBe("redirect:/admin/review?settled=1");
  });

  it("refuses a bad id or an overlong call before writing", async () => {
    expect(await settle({ id: "abc", back: "/admin/review" })).toMatch(/^redirect:\/admin\/review\?error=/);
    expect(await settle({ id: "7", decision: "x".repeat(2001), back: "/admin/review" })).toMatch(/error=/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("says so when the note was already settled", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    const to = await settle({ id: "7", back: "/admin/review" });
    expect(new URL(to.replace(/^redirect:/, ""), "https://bento.test").searchParams.get("error")).toBe("That note was already settled.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

const note = (over: Partial<ReviewNote>): ReviewNote => ({
  id: 1, place_id: "kyt-kiyomizu", field: "closes", kind: "disagree", current: "18:00",
  codex: { suggested: { ordinary: "18:00", "July–August": "18:30" }, note: "Seasonal.", source: "https://www.kiyomizudera.or.jp/access/" },
  gemini: { keep: true, note: "One time fits the field.", source: "own knowledge" },
  decision: null, settled_by: null, settled_at: null, ...over,
});

describe("ReviewNotes", () => {
  it("shows both views, links only https sources and offers to settle", () => {
    const html = renderToStaticMarkup(createElement(ReviewNotes, { notes: [note({})], back: "/admin/review" }));
    expect(html).toContain("Closes");
    expect(html).toContain("ordinary: 18:00 · July–August: 18:30");
    expect(html).toContain("Keep what Bento has");
    expect(html).toContain('href="https://www.kiyomizudera.or.jp/access/"');
    expect(html).not.toContain('href="own knowledge"');
    expect(html).toContain('name="decision"');
    expect(html).toContain("1 to settle");
  });

  it("shows a settled note's call instead of the form", () => {
    const html = renderToStaticMarkup(createElement(ReviewNotes, {
      notes: [note({ settled_at: "2026-10-22T10:00:00Z", settled_by: "owner@example.com", decision: "Keep 18:00." })],
      back: "/admin/review",
    }));
    expect(html).toContain("Settled by owner@example.com on <span class=\"mono\">2026-10-22</span>: Keep 18:00.");
    expect(html).not.toContain('name="decision"');
    expect(html).toContain("all settled");
  });

  it("renders nothing without notes", () => {
    expect(renderToStaticMarkup(createElement(ReviewNotes, { notes: [], back: "/admin/review" }))).toBe("");
  });
});
