import { describe, expect, it } from "vitest";
import { askWindowStart, draftPrompt, notToDraft, officialUrls, parseDraft, pickPlaces, requestDraft, requestDraftWithin } from "./background-draft";

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

describe("officialUrls", () => {
  it("keeps official pages and drops placeholders and encyclopaedias", () => {
    expect(officialUrls(["wikivoyage", "kiyomizudera.or.jp", "https://www.shokoku-ji.jp/kinkakuji/", "ja.wikipedia.org", "en.wikivoyage.org"]))
      .toEqual(["https://kiyomizudera.or.jp/", "https://www.shokoku-ji.jp/kinkakuji/"]);
  });
});

describe("notToDraft", () => {
  const rows = [
    { place_id: "a", status: "verified", drafted_by: "gemini-3.8-flash" },
    { place_id: "b", status: "draft", drafted_by: "gemini-3.8-flash" },
    { place_id: "c", status: "draft", drafted_by: "owner@example.com" },
  ];
  it("leaves every written place alone by default", () => expect(notToDraft(rows, false)).toEqual(new Set(["a", "b", "c"])));
  it("with --redraft, redrafts only the model's own drafts", () => expect(notToDraft(rows, true)).toEqual(new Set(["a", "c"])));
});

describe("parseDraft when the pages are thin", () => {
  it("skips when the pages don't say enough", () => {
    expect(parseDraft(gemini(`{"background":null}`, READ))).toEqual({ ok: false, reason: expect.stringMatching(/didn't say enough/) });
  });
  it("tells the model it may say so", () => {
    expect(draftPrompt({ name: "Gion", nameJa: null, city: "Kyoto", urls: [PAGE] })).toContain(`{"background": null}`);
  });
});

describe("requestDraft", () => {
  it("skips the place when Gemini doesn't answer", async () => {
    const timeout = Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_HEADERS_TIMEOUT" } });
    await expect(requestDraft(() => Promise.reject(timeout))).resolves.toEqual({ kind: "skip", reason: "Gemini didn't answer" });
  });
  it("stops the run when the quota is spent", async () => {
    await expect(requestDraft(async () => new Response("", { status: 429 }))).resolves.toEqual({ kind: "quota" });
  });
  it("skips the place on another HTTP error", async () => {
    await expect(requestDraft(async () => new Response("", { status: 503 }))).resolves.toEqual({ kind: "skip", reason: "Gemini HTTP 503" });
  });
  it("passes Gemini's reply on", async () => {
    await expect(requestDraft(async () => Response.json({ candidates: [] }))).resolves.toEqual({ kind: "reply", json: { candidates: [] } });
  });
});

describe("requestDraftWithin (Codex review on #50: every model call is held against the cap)", () => {
  const holdLog = () => {
    const settled: unknown[] = [];
    return { settled, take: async () => ({ settle: async (u: unknown) => { settled.push(u); } }) };
  };

  it("takes a hold before asking Gemini and settles it with what the reply cost", async () => {
    const { settled, take } = holdLog();
    const usageMetadata = { promptTokenCount: 1000, toolUsePromptTokenCount: 3000, candidatesTokenCount: 200 };
    const reply = await requestDraftWithin(take, async () => Response.json({ candidates: [], usageMetadata }), "gemini-3.8-flash");
    expect(reply.kind).toBe("reply");
    expect(settled).toEqual([{ model: "gemini-3.8-flash", inputTokens: 4000, outputTokens: 200, cachedTokens: 0, costUsd: (4000 * 0.75 + 200 * 3.75) / 1_000_000 }]);
  });

  it("gives the hold back when Gemini doesn't answer", async () => {
    const { settled, take } = holdLog();
    const reply = await requestDraftWithin(take, () => Promise.reject(new TypeError("fetch failed")), "gemini-3.8-flash");
    expect(reply).toEqual({ kind: "skip", reason: "Gemini didn't answer" });
    expect(settled).toEqual([null]);
  });

  it("stops without asking Gemini when Bento's budget is used up", async () => {
    let asked = false;
    const refuse = async () => { throw Object.assign(new Error("Bento's AI budget for this month is used up."), { name: "SpendCapExceeded" }); };
    const reply = await requestDraftWithin(refuse, async () => { asked = true; return Response.json({}); }, "gemini-3.8-flash");
    expect(reply).toEqual({ kind: "budget", reason: "Bento's AI budget for this month is used up." });
    expect(asked).toBe(false);
  });
});
