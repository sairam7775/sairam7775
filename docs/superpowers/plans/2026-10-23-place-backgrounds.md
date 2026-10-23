# Place Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bento keeps a checked, lasting background for each place. Bento Man retells it instead of relying on the model, records the places travellers ask about, and travellers can read it on the trip page.

**Architecture:** A new `place_backgrounds` table (service role only) plus a `place_backgrounds_public` view (checked backgrounds of verified places). A definer function counts asks, with no personal data. Bento Man gets a `place_background` tool and one prompt rule. A hand-run script drafts backgrounds from official pages with Gemini `url_context`. An admin page edits and approves them. The day box shows them.

**Tech Stack:** Next.js 16 server components and actions, Supabase Postgres (RLS, definer view and function), Zod, Vitest, Gemini REST (`generateContent` + `url_context`).

**Spec:** `docs/superpowers/specs/2026-10-23-place-backgrounds-design.md`

## Global Constraints

- Work in `bento/`. Base the branch on `main` after `claude/review-notes` (0025) and `claude/hours-and-price-bands` (0026) have merged; this migration is `0027`. If either is still open, keep 0027 and rebase later.
- The owner runs migrations in the Supabase SQL editor. Claude never applies them.
- Every traveller-facing word lives in `src/copy/en.ts`. Admin pages are exempt. Bento Man's prompt and tool text are not copy.
- A background is 120–900 characters, with no clock time (`/\b\d{1,2}[:：]\d{2}\b/`) and no price (`/¥|円|\byen\b/i`).
- Gemini drafting reads only the place's official pages, with `url_context`. Never Google Maps grounding.
- The prompt and tool change needs the eval on the live model. Ask the owner first, and run only `--only` the affected ids (the free-tier quota is shared with the live site).
- No API key or token in chat or in commits. Scripts read `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment.
- Commit messages are short and imperative, like `Add place backgrounds table`. Commit only when the owner has asked for this work to be committed.

## Review Focus

1. A draft whose official pages Gemini could not read must be skipped, never saved with invented text. Test: Task 5 `parseDraft` rejects when no page was read successfully.
2. A background with an opening time or a price ("open 9:00–17:00", "¥500") must be refused by the drafter and by the admin form. Tests: Task 2 `checkBackgroundText`, Task 6 `saveBackground`.
3. If counting an ask fails (an RPC error, an unknown place id), Bento Man's turn must still answer. Test: Task 3 `noteBackgroundAsk` swallows an RPC error.
4. Re-running the drafter must never overwrite a checked background. Test: Task 5 `pickPlaces` drops checked ids even when named on the command line.
5. A checked background of a place that is no longer verified must not reach travellers. Test: Task 1 check query (the view joins `places.verification_status = 'verified'`).

---

### Task 1: Tables, view and ask counter (migration 0027)

**Files:**
- Create: `supabase/migrations/0027_place_backgrounds.sql`
- Modify: `CLAUDE.md` (Curation section: one bullet)

**Interfaces:**
- Produces: table `place_backgrounds(place_id, body, sources, status, drafted_by, verified_by, verified_on, updated_at)`; view `place_backgrounds_public(place_id, body, sources)`; table `place_background_asks(place_id, day, asks)`; function `note_background_ask(p_place_id text) returns void`.

- [ ] **Step 1: Write the migration**

```sql
-- Bento · 0027 · checked place backgrounds
--
-- The lasting story of a place (history, what it is known for), checked by
-- an admin before a traveller sees it. Hours and prices stay on places.
-- Written only by the service role (no policy), like places.

create table place_backgrounds (
  place_id    text primary key references places (id) on delete cascade,
  body        text not null check (char_length(body) between 120 and 900),
  sources     text[] not null check (cardinality(sources) > 0),
  status      text not null default 'draft' check (status in ('draft', 'verified')),
  drafted_by  text not null,
  verified_by text,
  verified_on date,
  updated_at  timestamptz not null default now(),
  constraint place_backgrounds_signed
    check (status = 'draft' or (verified_by is not null and verified_on is not null))
);
alter table place_backgrounds enable row level security;

-- Checked backgrounds of verified places only. Runs as its owner, so the
-- writes Supabase grants by default are taken back (see 0013).
create view place_backgrounds_public as
  select b.place_id, b.body, b.sources
    from place_backgrounds b
    join places p on p.id = b.place_id
   where b.status = 'verified' and p.verification_status = 'verified';
revoke all on place_backgrounds_public from anon, authenticated;
grant select on place_backgrounds_public to authenticated;

-- Which places travellers ask about, per day. No user id, no message text.
create table place_background_asks (
  place_id text not null references places (id) on delete cascade,
  day      date not null default current_date,
  asks     int  not null default 1,
  primary key (place_id, day)
);
alter table place_background_asks enable row level security;

create function note_background_ask(p_place_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into place_background_asks (place_id) values (p_place_id)
  on conflict (place_id, day) do update set asks = place_background_asks.asks + 1;
end;
$$;
revoke all on function note_background_ask(text) from public;
grant execute on function note_background_ask(text) to authenticated;
```

- [ ] **Step 2: Add the CLAUDE.md bullet under "Curation data (P5)"**

The text: backgrounds (0027) are the lasting story of a place, written only by the service role, checked in `/admin/backgrounds`, and read through `place_backgrounds_public` (checked backgrounds of verified places). Hours and prices never go in them. Asks are counted by `note_background_ask`, with no personal data.

- [ ] **Step 3: Owner runs it in the SQL editor, then these checks**

```sql
select has_table_privilege('authenticated', 'place_backgrounds_public', 'insert');   -- false
select has_table_privilege('anon', 'place_backgrounds_public', 'select');            -- false
select has_function_privilege('anon', 'note_background_ask(text)', 'execute');       -- false
begin;
insert into place_backgrounds (place_id, body, sources, status, drafted_by, verified_by, verified_on)
  select id, repeat('A lasting story. ', 10), '{check}', 'verified', 'check', 'check', current_date
    from places where verification_status = 'draft' limit 1;
select count(*) from place_backgrounds_public;  -- 0: a draft place's checked background stays hidden
rollback;
```

Then run the Supabase security advisor (`get_advisors`, read-only) and expect no new findings for these objects.

- [ ] **Step 4: Commit** — `Add place backgrounds table and ask counter`

---

### Task 2: Background text rules and loader

**Files:**
- Create: `src/lib/places/backgrounds.ts`
- Test: `src/lib/places/backgrounds.test.ts`

**Interfaces:**
- Produces:
  - `interface PlaceBackground { placeId: string; body: string; sources: string[] }`
  - `checkBackgroundText(body: string): string | null`: the reason it is refused, or null if it passes.
  - `loadBackgrounds(db: SupabaseClient, placeIds: string[]): Promise<Map<string, PlaceBackground>>`: reads `place_backgrounds_public`. It skips the query when there are no ids. On error it logs and returns an empty map.

- [ ] **Step 1: Write the failing tests**

```ts
describe("checkBackgroundText", () => {
  const ok = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";
  it("passes a lasting story", () => expect(checkBackgroundText(ok)).toBeNull());
  it("refuses short and long text", () => {
    expect(checkBackgroundText("Old temple.")).toMatch(/120/);
    expect(checkBackgroundText("x".repeat(901))).toMatch(/900/);
  });
  it("refuses a clock time or a price", () => {
    expect(checkBackgroundText(`${ok} Open 9:00 daily.`)).toMatch(/time/);
    expect(checkBackgroundText(`${ok} Entry is ¥500.`)).toMatch(/price/);
  });
});
describe("loadBackgrounds", () => {
  it("does not query for no ids", async () => {
    expect((await loadBackgrounds(db, [])).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
  it("maps rows by place id", async () => {
    rows = [{ place_id: "kyt-kinkakuji", body: ok, sources: ["shokoku-ji.jp"] }];
    expect((await loadBackgrounds(db, ["kyt-kinkakuji"])).get("kyt-kinkakuji")).toEqual({ placeId: "kyt-kinkakuji", body: ok, sources: ["shokoku-ji.jp"] });
  });
  it("returns an empty map on a read error", async () => {
    error = new Error("down");
    await expect(loadBackgrounds(db, ["kyt-kinkakuji"])).resolves.toEqual(new Map());
  });
});
// db is a fake whose from("place_backgrounds_public").select().in() resolves { data: rows, error }.
```

- [ ] **Step 2: Run `npx vitest run src/lib/places/backgrounds.test.ts`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `backgrounds.ts`.** The refusal reasons are admin-facing, so they stay in this module and not in `copy`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit** — `Add background text rules and loader`

---

### Task 3: Store methods

**Files:**
- Modify: `src/lib/bento-man/store.ts` (`TripStore`), `src/lib/bento-man/store.memory.ts`, `src/lib/bento-man/store.supabase.ts`
- Test: `src/lib/bento-man/__tests__/store.supabase.test.ts`, `src/lib/bento-man/__tests__/tools.test.ts` (memory store cases live with the tool tests in Task 4)

**Interfaces:**
- Consumes: `PlaceBackground`, `loadBackgrounds` (Task 2).
- Produces:
  - On `TripStore`: `background(placeId: string): Promise<PlaceBackground | null>` and `noteBackgroundAsk(placeId: string): Promise<void>`.
  - On `MemorySetup`: `backgrounds?: Record<string, { body: string; sources: string[] }>`.
  - On `MemoryStore`: `asks: string[]` (the ids noted, in order).

- [ ] **Step 1: Write the failing tests in `store.supabase.test.ts`.** Extend `fixture()` with a `place_backgrounds_public` row and an rpc error switch.

```ts
it("reads a checked background through the public view", async () => {
  // rows.place_backgrounds_public = [{ place_id: "kyt-kinkakuji", body: B, sources: ["shokoku-ji.jp"] }]
  expect((await store.background("kyt-kinkakuji"))?.body).toBe(B);
  expect(selectCalls.some(([t]) => t === "place_backgrounds_public")).toBe(true);
});
it("counts an ask and never throws when counting fails", async () => {
  await store.noteBackgroundAsk("kyt-kinkakuji");
  expect(rpc).toHaveBeenCalledWith("note_background_ask", { p_place_id: "kyt-kinkakuji" });
  // rpc resolves { error: new Error("fk") } → resolves undefined, console.error called
  await expect(store.noteBackgroundAsk("nope")).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/bento-man/__tests__/store.supabase.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `SupabaseStore.background` uses `loadBackgrounds(this.db, [placeId])`.
  - `noteBackgroundAsk` calls `this.db.rpc("note_background_ask", { p_place_id })`, logs any error, and does not throw.
  - `MemoryStore` reads `setup.backgrounds` and pushes to `asks`.
- [ ] **Step 4: Run the tests again, plus `npm run typecheck`.** Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `Read place backgrounds and count asks in the trip store`

---

### Task 4: `place_background` tool, prompt rule and eval

**Files:**
- Modify: `src/lib/bento-man/tools.ts` (append the tool to `TOOLS` as the **last** entry, plus its `case`), `src/lib/bento-man/prompt.ts`, `src/lib/bento-man/mock.ts`, `src/lib/bento-man/evals/scenarios.ts`, `CLAUDE.md` (Bento Man section: one bullet)
- Test: `src/lib/bento-man/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `store.background`, `store.noteBackgroundAsk`, `store.searchPlaces` (Task 3). The input schema is the same as `get_place` (`{ query: string, city_id?: string }`), so reuse `GetPlace`.
- Produces: tool results.
  - Checked: `{ id, name, background, sources, checked: true }`.
  - None yet: `{ id, name, background: null, note }`.
  - No match: `{ matches: [], note }`, the same note as `get_place`.

Exact text:

- Tool description: `"A place's history and what it is known for, as checked text: the lasting story, never hours or prices. Use when the traveller asks about a place's history, its meaning or what it is known for. Returns the checked text and its sources, or none yet."`
- The `note` when there is none yet: `"no checked background yet: you may give two or three sentences of widely known background from general knowledge, and say it is general background; nothing a traveller would act on"`
- Append to the honesty-rule paragraph in `SYSTEM_PROMPT`: `" The one exception is a place's history and what it is known for, below."`
- New bullet after `- Facts.`: `"- History. When the traveller asks about a place's history, its meaning or what it is known for, call place_background. If it returns checked text, retell it briefly in your own words and add nothing to it. If it returns none, you may give two or three sentences of widely known background from general knowledge, and say it is general background. Never use this for opening hours, prices, times, closures, crowds or anything else the traveller would act on; those come only from get_place."`

- [ ] **Step 1: Write the failing tests in `tools.test.ts`**

```ts
it("place_background retells a checked background and counts nothing", async () => {
  const store = new MemoryStore({ ...base, backgrounds: { "kyt-kinkakuji": { body: B, sources: ["shokoku-ji.jp"] } } });
  const r = JSON.parse((await runTool("place_background", { query: "kyt-kinkakuji" }, ctx(store))).result);
  expect(r).toMatchObject({ id: "kyt-kinkakuji", background: B, checked: true });
  expect(store.asks).toEqual([]);
});
it("place_background with none yet counts the ask and allows general background", async () => {
  const r = JSON.parse((await runTool("place_background", { query: "Kiyomizu" }, ctx(store))).result);
  expect(r.background).toBeNull();
  expect(r.note).toMatch(/general background/);
  expect(store.asks).toEqual(["kyt-kiyomizu"]);
});
it("place_background for an unknown place counts nothing", async () => { /* matches: [], asks [] */ });
it("keeps the tool order stable, with place_background last", () => {
  expect(TOOLS.at(-1)?.name).toBe("place_background");
});
```

Use the helper names `tools.test.ts` already uses to run a tool. If they differ from `runTool`/`ctx`, use the file's own.

- [ ] **Step 2: Run `npx vitest run src/lib/bento-man/__tests__/tools.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the tool and the prompt text above.**
  - In `mock.ts`, before the `about` rule, send `/\b(history|story|background|known for)\b/i` with the place name after "of"/"behind"/"about" to `place_background`. Mirror the `about` regex.
- [ ] **Step 4: Run `npm test`, `npm run typecheck` and `npm run lint`.** Expected: all pass.
- [ ] **Step 5: Add two eval scenarios after `fact-unknown-place`**

```ts
{ id: "fact-background-checked", intent: "History comes from the checked background, not the model.",
  setup: { ...routed, backgrounds: { "kyt-kinkakuji": { body: KINKAKU, sources: ["shokoku-ji.jp"] } } },
  user: "What's the story behind Kinkaku-ji?",
  expect: { tools: ["place_background"], mustMatch: [/Yoshimitsu/], mustNotMatch: [/\b\d{1,2}:\d{2}\b/, /¥/] } },
{ id: "fact-background-general", intent: "With no checked background, general background is said as such, with nothing to act on.",
  setup: routed, user: "What's the history of Kiyomizu-dera?",
  expect: { tools: ["place_background"], mustMatch: [/general/i], mustNotMatch: [/\b\d{1,2}:\d{2}\b/, /¥/] } },
```

`KINKAKU` is the passing text from Task 2's test.

- [ ] **Step 6: Ask the owner, then run the eval subset**

Run: `npx tsx scripts/eval-bento-man.ts --only fact-lookup,fact-unknown-place,fact-hours-monday,fact-background-checked,fact-background-general`
Expected: 5/5 pass and voice lint clean. If the quota runs out (429), stop and report the ids that are left.

- [ ] **Step 7: Add the CLAUDE.md bullet**

The text: `place_background` is the one place general knowledge is allowed, for history only. It counts asks when there is no checked background. Its tests and the two `fact-background-*` scenarios guard it.

- [ ] **Step 8: Commit** — `Let Bento Man retell checked place backgrounds`

---

### Task 5: Drafting from official pages

**Files:**
- Create: `src/lib/places/background-draft.ts`, `scripts/draft-backgrounds.ts`
- Test: `src/lib/places/background-draft.test.ts`

**Interfaces:**
- Consumes: `checkBackgroundText` (Task 2).
- Produces:
  - `pickPlaces(asks: { place_id: string; asks: number }[], checked: Set<string>, limit: number, named?: string[]): string[]`. Uses the named ids if given, otherwise sums asks per place, sorted by asks (descending) then id. It always drops checked ids, then takes `limit`.
  - `draftPrompt(p: { name: string; nameJa: string | null; city: string; urls: string[] }): string`.
  - `parseDraft(response: unknown): { ok: true; body: string; sources: string[] } | { ok: false; reason: string }`, where `response` is Gemini's `generateContent` JSON. It reads the candidate text (stripping a code fence) and `urlContextMetadata.urlMetadata`.
    - `ok: false` if no page has status `URL_RETRIEVAL_STATUS_SUCCESS`.
    - `ok: false` if the JSON is unreadable.
    - `ok: false` if `checkBackgroundText` refuses the body.
    - `sources` is the successfully read URLs.

The prompt text (exact):

```
Write the background of {name} ({nameJa}) in {city}, Japan, for a first-time visitor, in two to four plain sentences: when and why it was built or founded, what happened to it that matters, and what it is known for. Use only what these official pages say: {urls}. Write it in your own words; do not copy sentences. No opening hours, prices, crowd advice or anything that changes. Do not use Google Maps.
Reply with ONLY a JSON object, no code fence: {"background": "..."}
```

- [ ] **Step 1: Write the failing tests**

```ts
it("skips a draft when no official page was read", () => {
  expect(parseDraft(gemini(`{"background":"${OK}"}`, [{ url: "https://x.jp/", status: "URL_RETRIEVAL_STATUS_ERROR" }])))
    .toEqual({ ok: false, reason: expect.stringMatching(/no official page/) });
});
it("refuses a draft with a price", () => {
  expect(parseDraft(gemini(`{"background":"${OK} Entry is ¥500."}`, READ)).ok).toBe(false);
});
it("keeps the read pages as sources", () => {
  expect(parseDraft(gemini(`{"background":"${OK}"}`, READ))).toEqual({ ok: true, body: OK, sources: ["https://www.shokoku-ji.jp/kinkakuji/"] });
});
it("never picks a checked place, even when named", () => {
  expect(pickPlaces([], new Set(["a"]), 5, ["a", "b"])).toEqual(["b"]);
});
it("picks the most-asked places first", () => {
  expect(pickPlaces([{ place_id: "a", asks: 1 }, { place_id: "b", asks: 2 }, { place_id: "a", asks: 3 }], new Set(), 1)).toEqual(["a"]);
});
it("names every official page in the prompt", () => {
  expect(draftPrompt({ name: "Kinkaku-ji", nameJa: "金閣寺", city: "Kyoto", urls: ["https://www.shokoku-ji.jp/kinkakuji/"] })).toContain("https://www.shokoku-ji.jp/kinkakuji/");
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/places/background-draft.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `background-draft.ts`.**
- [ ] **Step 4: Write `scripts/draft-backgrounds.ts`.** Copy the header and env checks from `scripts/grant-admin.ts`.
  - Usage: `npx tsx scripts/draft-backgrounds.ts [--places id,id] [--limit 5] [--model gemini-3.8-flash] [--write]`.
  - Reads asks from the last 90 days and the checked ids from `place_backgrounds` (`status = 'verified'`).
  - Reads each place's `name, name_ja, city_id, sources` from `places`. Each source becomes `https://<domain>/`. A place with no source is skipped: "no official page on record".
  - One request per place to `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, with `tools: [{ url_context: {} }]` and a 13-second pause between requests. On a 429 it stops and prints the places left.
  - Prints `id · drafted | skipped: reason` and the text.
  - With `--write`, it upserts each draft as `{ place_id, body, sources, status: "draft", drafted_by: model, updated_at: now }`.
- [ ] **Step 5: Run the tests again, plus `npm run typecheck`.** Expected: PASS. Then ask the owner before a live dry run (`--limit 1`, no `--write`).
- [ ] **Step 6: Commit** — `Draft place backgrounds from official pages`

---

### Task 6: Admin page to check and approve

**Files:**
- Create: `src/app/admin/backgrounds/page.tsx`, `src/app/admin/background-actions.ts`
- Modify: `src/app/admin/page.tsx` (a link beside "Trip reviews")
- Test: `src/app/__tests__/background-actions.test.ts` (mocking the same way as `cleanup-actions.test.ts`)

**Interfaces:**
- Consumes: `requireAdmin` (`{ user, db }`), `checkBackgroundText`.
- Produces two server actions:
  - `saveBackground(formData)`. Fields: `placeId`, `body`, `sources` (a comma list). It upserts the row with `status: "draft"`, `verified_by: null`, `verified_on: null`, `drafted_by: user.email ?? user.id`. It refuses through `?error=` when `checkBackgroundText` gives a reason or there is no source.
  - `approveBackground(formData)`. Field: `placeId`. It updates to `status: "verified"`, `verified_by`, and `verified_on` (today), only `.eq("status", "draft")`.
  - Both revalidate `/admin/backgrounds` and redirect back to it.

- [ ] **Step 1: Write the failing tests**

```ts
it("refuses a background with an opening time", async () => {
  await expect(saveBackground(form({ placeId: "kyt-kinkakuji", body: `${OK} Open 9:00.`, sources: "shokoku-ji.jp" })))
    .rejects.toThrow(/redirect:\/admin\/backgrounds\?error=/);
  expect(mocks.upsert).not.toHaveBeenCalled();
});
it("saving sends a checked background back to draft", async () => {
  await expect(saveBackground(form({ placeId: "kyt-kinkakuji", body: OK, sources: "shokoku-ji.jp" }))).rejects.toThrow(/redirect/);
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: "draft", verified_by: null, verified_on: null }), { onConflict: "place_id" });
});
it("approves only a draft, signed by the admin", async () => {
  // requireAdmin resolves { user: { email: "owner@example.com" }, db }
  await expect(approveBackground(form({ placeId: "kyt-kinkakuji" }))).rejects.toThrow(/redirect/);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "verified", verified_by: "owner@example.com" }));
  expect(mocks.eq).toHaveBeenCalledWith("status", "draft");
});
```

- [ ] **Step 2: Run `npx vitest run src/app/__tests__/background-actions.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement the actions and the page.**
  - The page has three sections:
    - **Asked about, not written yet:** the top 30 by asks in the last 90 days with no row, each with an empty form.
    - **Drafts to check:** each with an editable textarea, sources, `drafted_by`, Save and Approve.
    - **Checked:** a count.
  - Match the look of `/admin/trip-reviews`.
- [ ] **Step 4: Run `npm test`, `npm run typecheck` and `npm run lint`.** Expected: all pass.
- [ ] **Step 5: Commit** — `Check and approve place backgrounds in admin`

---

### Task 7: "About this place" on the trip page

**Files:**
- Modify: `src/copy/en.ts` (`copy.day.about: "About this place"`), `src/app/trips/[id]/day-box.tsx` (`DayBoxItem.background?: string | null`, plus a `<details>` under the reason), `src/app/trips/[id]/page.tsx` (load and pass it)

**Interfaces:**
- Consumes: `loadBackgrounds` (Task 2).

- [ ] **Step 1: Implement.**
  - `page.tsx` calls `loadBackgrounds(db, (dayItems ?? []).map((i) => i.placeId))` and passes `items={(dayItems ?? []).map((i) => ({ ...i, background: backgrounds.get(i.placeId)?.body ?? null }))}`.
  - `day-box.tsx` renders `<details>` with `<summary>{t.about}</summary>` and the body. Style it with tokens (`text-ink-2`, `text-accent-ink`). Like the map link, cancel a drag that starts on the summary.
- [ ] **Step 2: Run `npm test` (`copy.test.ts` covers the new line), `npm run typecheck` and `npm run lint`.** Expected: all pass.
- [ ] **Step 3: Check it in the app.** Use the `run` skill. Approve one background on a local or temp place (temp Supabase users need the owner's OK each time). Take light and dark screenshots at phone width and attach them to the PR.
- [ ] **Step 4: Commit** — `Show checked place backgrounds on the trip page`
