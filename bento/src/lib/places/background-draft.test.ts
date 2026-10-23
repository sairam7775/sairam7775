import { describe, expect, it } from "vitest";
import { askWindowStart, draftPrompt, parseDraft, pickPlaces } from "./background-draft";

const OK = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";
const PAGE = "https://www.shokoku-ji.jp/kinkakuji/";
const READ = [{ url: PAGE, status: "URL_RETRIEVAL_STATUS_SUCCESS" }];

/** A generateContent response as Gemini sends it with url_context on. */
const gemini = (text: string, read: { url: string; status: string }[]) => ({
  candidates: [{
    content: { parts: [{ text }] },
    urlContextMetadata: { urlMetadata: read.map((r) => ({ retrievedUrl: r.url, urlRetrievalStatus: r.status })) },
  }],
});

describe("parseDraft", () => {
  it("skips a draft when no official page was read", () => {
    expect(parseDraft(gemini(`{"background":"${OK}"}`, [{ url: "https://x.jp/", status: "URL_RETRIEVAL_STATUS_ERROR" }])))
      .toEqual({ ok: false, reason: expect.stringMatching(/no official page/) });
  });

  it("refuses a draft with a price", () => {
    expect(parseDraft(gemini(`{"background":"${OK} Entry is ¥500."}`, READ)).ok).toBe(false);
  });

  it("keeps the read pages as sources", () => {
    expect(parseDraft(gemini(`{"background":"${OK}"}`, READ))).toEqual({ ok: true, body: OK, sources: [PAGE] });
  });

  it("reads a reply wrapped in a code fence", () => {
    expect(parseDraft(gemini("```json\n" + `{"background":"${OK}"}` + "\n```", READ))).toMatchObject({ ok: true, body: OK });
  });

  it("refuses a reply that isn't the JSON asked for", () => {
    expect(parseDraft(gemini("Sorry, I can't help with that.", READ))).toEqual({ ok: false, reason: expect.stringMatching(/unreadable/) });
    expect(parseDraft({})).toMatchObject({ ok: false });
  });
});

describe("pickPlaces", () => {
  it("never picks a checked place, even when named", () => {
    expect(pickPlaces([], new Set(["a"]), 5, ["a", "b"])).toEqual(["b"]);
  });

  it("picks the most-asked places first", () => {
    expect(pickPlaces([{ place_id: "a", asks: 1 }, { place_id: "b", asks: 2 }, { place_id: "a", asks: 3 }], new Set(), 1)).toEqual(["a"]);
  });

  it("breaks ties by id and stops at the limit", () => {
    expect(pickPlaces([{ place_id: "c", asks: 1 }, { place_id: "b", asks: 1 }, { place_id: "a", asks: 1 }], new Set(["a"]), 1)).toEqual(["b"]);
  });
});

describe("draftPrompt", () => {
  it("names every official page and rules out what changes", () => {
    const text = draftPrompt({ name: "Kinkaku-ji", nameJa: "金閣寺", city: "Kyoto", urls: [PAGE] });
    expect(text).toContain(PAGE);
    expect(text).toContain("Kinkaku-ji (金閣寺) in Kyoto");
    expect(text).toMatch(/No opening hours, prices/);
    expect(text).toMatch(/Do not use Google Maps/);
  });
});

describe("askWindowStart", () => {
  it("counts asks from the last 90 days", () => {
    expect(askWindowStart(new Date("2026-10-23T12:00:00Z"))).toBe("2026-07-25");
  });
});
