# Bento Man, animated — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Bento Man a body and five moods (the indigo-coated guide with a lacquer head), shown as a still drawing first and animated with Lottie where the app calls for it.

**Architecture:** One art source (`parts.ts` + `moods.ts`) describes every shape, colour role, pivot and keyframe. A pure renderer turns it into inline SVG (the still, server-rendered); a pure builder turns it into Lottie JSON, written to `public/mascot/` by a script and guarded by a staleness test. A small client component shows the still, then lazy-loads the Lottie light player when the figure is visible and motion is allowed.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind v4 tokens in `globals.css`, Vitest (node env, `src/**/*.test.ts` only), `lottie-web@5.13.0` (light SVG player), `tsx` for the script.

**Spec:** `docs/superpowers/specs/2026-10-19-bento-man-character-design.md` (reference drawings with exact coordinates: `docs/superpowers/specs/2026-10-19-bento-man/*.svg`).

## Global Constraints

- All paths below are inside `bento/` unless they start with `docs/`. Work on branch `claude/bento-man-character` in the `sairam7775-spend` worktree.
- Dependency: `lottie-web` pinned to exactly `5.13.0`; import only `lottie-web/build/player/lottie_light`, and only via dynamic `import()` inside an effect.
- Lottie: version string `"5.7.4"`, `fr: 30`. Canvases: head 76 × 80 with art offset (6, 10); full 96 × 132 with art offset (0, 10). Each file has markers `intro` (tm 0) and `idle`.
- Files shipped, exactly: `public/mascot/full-hello.json`, `full-lost.json`, `head-think.json`, `head-happy.json`, `head-hello.json`; each under 25 000 bytes.
- Colour roles and values (light / dark) as in the spec table. Themed roles (CSS variables `--color-mascot-<role>`): `line` #221C1E / #FBF8F3, `rim` #221C1E / #4A4145, `sheen` #5A5256 / #7A7075, `coat` #2E4A7D / #5876B5, `belt` #1C2E52 / #2E4A7D, `pants` #5A5256 / #8A8085, `muted` #6F666B / #9A9095. Fixed roles: `tile` #FFFFFF, `face` #221C1E, `ume` #FF7757, `white` #FFFFFF, `skin` #F6CFB3, `paper` #F4E9D6, `spark` #FFC94A.
- Each animation's frame 0 equals that figure's still pose.
- The figure is `aria-hidden`; reduced motion → still only and no player download; a failed load leaves the still.
- Unchanged: `BentoLogo`/`BentoMark` in headers and footer, favicons/app icons, `BentoLoader`/`PageLoader`, `global-error.tsx`, Bento Man's prompts (no model eval).
- Commits: concise imperative subject; end with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01BAPyVaepe3NSc5JqbARfPj`).
- **One deliberate change from the spec, to confirm with the owner:** *hello* plays on every page load rather than once per session. Remembering it would need device storage, which the cookie policy would then have to list; a 2–3 second wave per visit is the simpler choice.

## Review Focus

1. **Theme switched while he animates** (Settings → Appearance, or the OS) — colours flip at once with no reload. Pinned in Task 4, Step 7.
2. **Many replies in one chat** (50+ messages) — only figures with a file load the player, once; rest heads never fetch anything. Pinned by `fileFor("head-rest") === null` (Task 4) and the network check in Task 8.
3. **Player or JSON blocked / offline** — the still stays, no console error. Pinned in Task 4, Step 7 and Task 8.
4. **Navigating away mid-animation** — the animation is destroyed on unmount; no errors or leaks. Pinned in Task 8.
5. **Hydration** — server and first client render produce identical markup (no `window` during render). Pinned in Task 8 (console clean on load).

---

### Task 1: Baseline, art types and the SVG-path → Lottie-bezier parser

**Files:**
- Create: `src/components/mascot/types.ts`, `src/components/mascot/path.ts`
- Test: `src/components/mascot/path.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `type ThemedRole = "line" | "rim" | "sheen" | "coat" | "belt" | "pants" | "muted"`; `type FixedRole = "tile" | "face" | "ume" | "white" | "skin" | "paper" | "spark"`; `type Role = ThemedRole | FixedRole`
  - `const ROLE_COLOR: Record<Role, string>` (light values); `const THEMED_ROLES: ThemedRole[]`
  - `type Paint = { fill?: Role; stroke?: Role; width?: number; cap?: "round" | "butt"; join?: "round" | "miter"; dash?: [number, number]; opacity?: number }`
  - `type Shape = Paint & ({ kind: "rect"; x: number; y: number; w: number; h: number; r: number } | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number } | { kind: "path"; d: string })`
  - `interface Part { id: string; parent?: string; at?: [number, number]; scale?: number; pivot?: [number, number]; opacity?: number; shapes: Shape[] }` (`at`/`scale` = static placement in the parent's coordinates; `pivot` in the part's own coordinates; `opacity` is the rest value, default 100)
  - `type Prop = "position" | "rotation" | "scale" | "opacity"`; `type Value = number | [number, number]`
  - `interface Track { part: string; prop: Prop; keys: [frame: number, value: Value][]; hold?: boolean }` (frames absolute; position is an offset from rest; scale in percent)
  - `type FigureKey = "head-rest" | "head-think" | "head-happy" | "head-hello" | "full-hello" | "full-lost"`
  - `interface Figure { key: FigureKey; form: "head" | "full"; parts: Part[]; intro: number; idle: number; tracks: Track[] }` (parts in paint order, first = bottom)
- Produces (path.ts): `interface Contour { c: boolean; v: [number, number][]; i: [number, number][]; o: [number, number][] }`; `function toContours(d: string): Contour[]` (Lottie `sh` shape: `i`/`o` are tangents relative to their vertex)

- [ ] **Step 1: Capture the performance baseline** (before any app change)

Run: `npm run build && npm start` in `bento/`, then Lighthouse (chrome-devtools MCP, mobile) on `http://localhost:3000/` and `http://localhost:3000/no-such-page`. Record performance score, LCP, CLS and the build's "First Load JS" for `/` in the scratchpad `mascot-baseline.md`. Stop the server.

- [ ] **Step 2: Write the failing parser tests**

```ts
import { describe, expect, it } from "vitest";
import { toContours } from "./path";

const round = (cs: ReturnType<typeof toContours>) =>
  JSON.parse(JSON.stringify(cs, (_k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));

describe("toContours", () => {
  it("closes a polygon and drops no vertices", () => {
    expect(round(toContours("M0 0L10 0L10 10Z"))).toEqual([
      { c: true, v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] },
    ]);
  });
  it("splits subpaths and reads relative h/v", () => {
    const cs = toContours("M32 4v56M4 32h56");
    expect(cs.map((c) => c.v)).toEqual([[[32, 4], [32, 60]], [[4, 32], [60, 32]]]);
    expect(cs.every((c) => !c.c)).toBe(true);
  });
  it("turns a quadratic into cubic tangents", () => {
    const [c] = round(toContours("M0 0q4 4 8 0"));
    expect(c.v).toEqual([[0, 0], [8, 0]]);
    expect(c.o[0]).toEqual([2.667, 2.667]);
    expect(c.i[1]).toEqual([-2.667, 2.667]);
  });
  it("reflects the control point for t", () => {
    const [c] = round(toContours("M27 53q1.5 -2 3 0t3 0"));
    expect(c.v).toEqual([[27, 53], [30, 53], [33, 53]]);
    expect(c.o[1]).toEqual([1, 1.333]); // reflected control (31.5, 55): 2/3 of (1.5, 2)
  });
  it("tokenises numbers with no separators", () => {
    expect(toContours("M1 1l.5-1.5")[0].v).toEqual([[1, 1], [1.5, -0.5]]);
  });
});
```

- [ ] **Step 3: Run it — expect failure**

Run: `npx vitest run src/components/mascot/path.test.ts` → FAIL ("Cannot find module './path'").

- [ ] **Step 4: Implement `types.ts` and `toContours(d)`**

Tokenise with `/[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g`; support M/m (extra pairs = L), L/l, H/h, V/v, C/c, S/s, Q/q, T/t, Z/z; quadratic → cubic with c1 = p0 + ⅔(q − p0), c2 = p + ⅔(q − p); on Z set `c: true` and drop a final vertex equal to the first.

- [ ] **Step 5: Run it — expect pass**, then `npm run typecheck`.

- [ ] **Step 6: Commit** — `git commit -m "Add the mascot art types and an SVG path parser"` (with attribution lines).

---

### Task 2: Head art, the still renderer and colour roles

**Files:**
- Create: `src/components/mascot/parts.ts`, `src/components/mascot/moods.ts`, `src/components/mascot/still.ts`
- Modify: `src/app/globals.css` (tokens in `:root`, both dark blocks, and the role rules)
- Test: `src/components/mascot/moods.test.ts`, `src/components/mascot/still.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - parts.ts builders (head-local coordinates, copied from `docs/superpowers/specs/2026-10-19-bento-man/*.svg`): `lacquerHead(id: string, at?: [number, number]): Part` (rim rect 1,1,62,62 r18 `rim`; sheen rect 3.4,3.4,57.2,57.2 r15.6 stroke `sheen` 0.9; four `tile` rects 22.5 × 22.5 r6 at (7,7) (34.5,7) (7,34.5) (34.5,34.5); pivot (32, 60)); `umeboshi(parent: string): Part` (ellipse 18,18 r7 `ume`, pivot (18,18)); `eyes(parent: string, kind: "dots" | "happy" | "wink", opacity = 100): Part[]` — `dots`: one part `eyes` (pivot (32, 43)) with circles (20,43) and (44,43) r3.6 `face`; `happy`: one part `eyesHappy` with path `M16 45q4 -6 8 0M40 45q4 -6 8 0` stroke `face` 3.2 round; `wink`: a shapeless part `eyes` (pivot (32, 43)) with children `eyeL` (left dot), `eyeR` (right dot, rest opacity 0) and `winkR` (path `M40 44q4 -5 8 0`, stroke `face` 3.2 round). `opacity` sets the rest opacity of the returned top part (head-happy uses `eyes(…, "dots", 0)`)
  - moods.ts: `const FIGURES: Record<FigureKey, Figure>`; `const CANVAS = { head: { w: 76, h: 80, offset: [6, 10] }, full: { w: 96, h: 132, offset: [0, 10] } }`; `function valueAt(track: Track, frame: number): Value` (linear between keys, holds after the last; step when `hold`)
  - still.ts: `function MascotStill(props: { figure: FigureKey; size: number }): ReactElement` built with `createElement` (no JSX, so Vitest's node env can render it): `<svg viewBox="{-ox} {-oy} {w} {h}" aria-hidden="true">`; head: width = height = size; full: height = size, width = round(size × 96 / 132). Each shape gets class `bm-f-<role>` / `bm-s-<role>` and its light colour as the attribute; parts nest as `<g transform="translate(at) scale(s)">`; a part whose rest opacity is 0 renders with `opacity="0"`.

- [ ] **Step 1: Write the failing tests**

`moods.test.ts` — for every figure (only `head-rest` and `head-think` exist after this task; the tests iterate `FIGURES`):

```ts
it("starts every track on the still pose", () => {
  for (const f of Object.values(FIGURES)) for (const t of f.tracks) {
    const part = f.parts.find((p) => p.id === t.part)!;
    const rest = { position: [0, 0], rotation: 0, scale: [100, 100], opacity: part.opacity ?? 100 }[t.prop];
    expect(t.keys[0], `${f.key} ${t.part}.${t.prop}`).toEqual([0, rest]);
  }
});
it("loops without a seam", () => {
  for (const f of Object.values(FIGURES)) for (const t of f.tracks)
    expect(valueAt(t, f.intro), `${f.key} ${t.part}.${t.prop}`).toEqual(valueAt(t, f.intro + f.idle));
});
it("names only parts that exist, keeps keys in order and inside the timeline", () => { /* parent and track.part ids resolve; frames strictly increase; last ≤ intro + idle */ });
it("gives every animated part a pivot", () => { /* rotation/scale tracks → part.pivot defined */ });
```

`still.test.ts`:

```ts
const html = renderToStaticMarkup(createElement(MascotStill, { figure: "head-think", size: 40 }));
expect(html).toContain('viewBox="-6 -10 76 80"');
expect(html).toContain('width="40"');
expect(html).toContain('aria-hidden="true"');
expect(html).toContain('class="bm-f-rim"');
expect(html).toContain('fill="#FF7757"');
```

- [ ] **Step 2: Run — expect failure** (`npx vitest run src/components/mascot`).

- [ ] **Step 3: Implement the builders, `head-rest`, `head-think` and `MascotStill`**

`head-rest`: lacquer head, umeboshi, dot eyes; no tracks; intro 0, idle 0. `head-think`: same parts, eyes placed at `at: [1.6, -1.8]`; intro 0, idle 144; tracks:

| Part · prop | Keys `[frame, value]` |
|---|---|
| umeboshi · position | [0,[0,0]] [22,[0,0]] [29,[14,-10]] [36,[28,0]] [58,[28,0]] [65,[14,-10]] [72,[0,0]] [94,[0,0]] [101,[14,-10]] [108,[28,0]] [130,[28,0]] [137,[14,-10]] [144,[0,0]] |
| eyes · scale | [0,[100,100]] [132,[100,100]] [136,[100,10]] [140,[100,100]] [144,[100,100]] |

- [ ] **Step 4: Add the colour roles to `globals.css`**

Add the seven `--color-mascot-*` light values to the `@theme`/`:root` token block and the dark values to **both** dark blocks (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`). Then, for each themed role, `.mascot .bm-f-<role>, .mascot .bm-f-<role> * { fill: var(--color-mascot-<role>) }` and the `stroke` equivalent for `bm-s-<role>`.

- [ ] **Step 5: Run — expect pass**; `npm run typecheck`; `npm run lint`.

- [ ] **Step 6: Commit** — "Draw Bento Man's head from one art source".

---

### Task 3: The Lottie builder, the generator script and the first file

**Files:**
- Create: `src/components/mascot/lottie.ts`, `scripts/build-mascot.ts`, `public/mascot/head-think.json`
- Modify: `package.json` (script `"mascot": "tsx scripts/build-mascot.ts"`)
- Test: `src/components/mascot/lottie.test.ts`

**Interfaces:**
- Consumes: `FIGURES`, `CANVAS`, `toContours`, `ROLE_COLOR`.
- Produces: `const FILES: FigureKey[]` (figures with `intro + idle > 0`; after this task only `head-think`); `function buildLottie(key: FigureKey): object`.

**Mapping (the decisions the builder must follow):**
- Every part → a null layer (`ty: 3`) with `a` = pivot (default [0,0]), `p` = canvas offset (top-level parts only) + `at` + `scale` × pivot, `s` = `scale` × 100, plus its tracks (position values add to `p`; rotation in degrees; scale and opacity in percent). `parent` = the parent part's null layer `ind`.
- Shapes → shape layers (`ty: 4`) parented to their part's null, identity transform. Split a part's shapes into runs of the same single paint: a shape with both fill and stroke emits its fill first, then its stroke. One run = one layer with `cl: "bm-f-<role>"` or `"bm-s-<role>"`, holding one `gr` per shape (`rc` with centre `p`, `s`, `r`; `el` with `p`, `s` = 2·radii; one `sh` per contour), then `fl` (`c` = role colour as 0–1 RGBA, `o` = paint opacity or 100) or `st` (`w`, `lc` 2 round / 1 butt, `lj` 2 round / 1 miter, dashes as `d: [{n:"d",v},{n:"g",v}]`).
- Lottie lists layers top first: emit in reverse paint order.
- Animated values: `{a:1, k:[{t, s:[…], i:{x:[0.58],y:[1]}, o:{x:[0.42],y:[0]}}, …, {t:last, s:[…]}]}`; with `hold`, each key gets `h: 1`. Static: `{a:0, k}`. Round numbers to 3 decimals.
- Root: `v: "5.7.4"`, `fr: 30`, `ip: 0`, `op: intro + idle`, `w`/`h` from `CANVAS`, `layers` with `ip: 0`, `op` as root, `st: 0`; `markers: [{tm: 0, cm: "intro", dr: intro}, {tm: intro, cm: "idle", dr: idle}]`.

- [ ] **Step 1: Write the failing tests**

```ts
for (const key of FILES) {
  it(`${key} is up to date`, () => {
    const committed = readFileSync(`public/mascot/${key}.json`, "utf8");
    expect(committed, "run npm run mascot").toBe(JSON.stringify(buildLottie(key)));
  });
  it(`${key} is a sound Lottie file`, () => {
    const j = buildLottie(key) as any;
    const { w, h } = CANVAS[FIGURES[key].form];
    expect([j.v, j.fr, j.w, j.h]).toEqual(["5.7.4", 30, w, h]);
    expect(j.markers.map((m: any) => m.cm)).toEqual(["intro", "idle"]);
    expect(j.markers[1].tm).toBe(j.markers[0].dr);
    expect(j.op).toBe(j.markers[1].tm + j.markers[1].dr);
    for (const l of j.layers) if (l.ty === 4) expect(l.cl).toMatch(/^bm-[fs]-(line|rim|sheen|coat|belt|pants|muted|tile|face|ume|white|skin|paper|spark)$/);
    expect(JSON.stringify(j).length).toBeLessThan(25_000);
  });
}
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement `buildLottie` and `scripts/build-mascot.ts`** (relative imports, like `scripts/eval-bento-man.ts`; writes `JSON.stringify(buildLottie(key))` to `public/mascot/<key>.json` for each of `FILES`).

- [ ] **Step 4: Generate** — `npm run mascot`; expect `public/mascot/head-think.json` written.

- [ ] **Step 5: Run — expect pass**; typecheck; lint.

- [ ] **Step 6: Commit** — "Generate Bento Man's Lottie files from the art source".

---

### Task 4: The figure component and the trial in the chat's "Working" line (spike gate)

**Files:**
- Create: `src/components/mascot/playback.ts`, `src/components/mascot/figure.tsx`, `src/types/lottie-light.d.ts`
- Modify: `package.json` (`lottie-web` exactly `5.13.0`), `src/app/trips/[id]/chat.tsx` (`Working`)
- Test: `src/components/mascot/playback.test.ts`

**Interfaces:**
- Consumes: `MascotStill`, `FILES`.
- Produces:
  - `function fileFor(key: FigureKey): string | null` → `/mascot/<key>.json` when `key` is in `FILES`, else `null`
  - `function shouldAnimate(o: { reducedMotion: boolean; file: string | null }): boolean`
  - `function segmentsOf(markers: { cm: string; tm: number; dr: number }[]): { intro: [number, number] | null; idle: [number, number] }` (intro `null` when its `dr` is 0)
  - `function newlyAccepted(prev: Map<string, string | undefined>, next: { id: string; status?: string }[]): string[]` — ids whose status went from `"proposed"` to `"accepted"`
  - `"use client"` `function BentoManFigure(props: { figure: FigureKey; size: number; className?: string }): JSX.Element` — a `span.mascot` sized like the still, `aria-hidden`, containing `MascotStill` and an empty host. Effect: if `shouldAnimate`, observe with `IntersectionObserver`; on first intersection `import("lottie-web/build/player/lottie_light")` and `fetch(file)`, `loadAnimation({ container: host, renderer: "svg", loop: false, autoplay: false, animationData })`; on `DOMLoaded` hide the still (`visibility: hidden`) and play `intro` once (if any), then set `loop = true` and play `idle`. Pause/resume on intersection changes (a background tab needs no code: the player runs on `requestAnimationFrame`, which the browser stops). `destroy()` on unmount. Any rejection → keep the still.
  - `lottie-light.d.ts`: `declare module "lottie-web/build/player/lottie_light" { import lottie from "lottie-web"; export default lottie; }`

- [ ] **Step 1: Write the failing tests** for the four helpers:

```ts
expect(fileFor("head-think")).toBe("/mascot/head-think.json");
expect(fileFor("head-rest")).toBeNull();
expect(shouldAnimate({ reducedMotion: true, file: "/mascot/head-think.json" })).toBe(false);
expect(shouldAnimate({ reducedMotion: false, file: null })).toBe(false);
expect(shouldAnimate({ reducedMotion: false, file: "/mascot/head-think.json" })).toBe(true);
expect(segmentsOf([{ cm: "intro", tm: 0, dr: 72 }, { cm: "idle", tm: 72, dr: 120 }])).toEqual({ intro: [0, 72], idle: [72, 192] });
expect(segmentsOf([{ cm: "intro", tm: 0, dr: 0 }, { cm: "idle", tm: 0, dr: 144 }])).toEqual({ intro: null, idle: [0, 144] });
expect(newlyAccepted(new Map([["a", "proposed"], ["b", "accepted"]]),
  [{ id: "a", status: "accepted" }, { id: "b", status: "accepted" }, { id: "c", status: "accepted" }])).toEqual(["a"]);
```

- [ ] **Step 2: Run — expect failure.**

- [ ] **Step 3: Implement** `playback.ts`, `figure.tsx`, the type shim; `npm install lottie-web@5.13.0 --save-exact`.

- [ ] **Step 4: Run tests — expect pass**; typecheck; lint.

- [ ] **Step 5: Use it in the chat's `Working` line**

In `chat.tsx`, `Working` renders `<BentoManFigure figure="head-think" size={20} />` in place of `<BentoLoader size={18} label={label} />`, and its `<p>` gains `role="status" aria-live="polite"` so the label is still announced. Remove the `BentoLoader` import if unused.

- [ ] **Step 6: Build check** — `npm run build`; the "First Load JS" for `/trips/[id]` grows by no more than ~3 KB (the player is a separate chunk).

- [ ] **Step 7: Spike gate — check in a browser** (dev server; signing in needs a temporary Supabase user: **ask the owner first**, delete it afterwards)

Send a chat message and watch the Working line at 390 px:
- the umeboshi hops and the eyes blink, and the still's first frame matches the animation's (no jump on swap);
- switch Settings → Appearance to dark mid-animation: the rim turns #4A4145 at once;
- with reduced motion emulated, the still shows and no request for `lottie_light` or `/mascot/` appears;
- with `/mascot/*` blocked in DevTools, the still stays and the console is clean.

If the dark recolour fails, stop and report: the fallback (one file per theme) changes Tasks 3–5.

- [ ] **Step 8: Commit** — "Show Bento Man thinking while he works".

---

### Task 5: The full figure and the remaining moods

**Files:**
- Modify: `src/components/mascot/parts.ts`, `src/components/mascot/moods.ts`
- Create: `public/mascot/full-hello.json`, `full-lost.json`, `head-happy.json`, `head-hello.json` (generated)
- Test: existing `moods.test.ts`, `lottie.test.ts` now cover the new figures; add to `still.test.ts`: `MascotStill` for `full-hello` at size 132 has `viewBox="0 -10 96 132"`, `height="132"`, `width="96"`.

**Interfaces:**
- Produces in parts.ts (page coordinates from the reference SVGs): `feet(): Part` (trousers, socks with straps, sandals); `coat(): Part` (coat, collar band as `line` 6.5 then `white` 3.8 along `M41 62.5L48 80L55 62.5`, belt, bow tails, loops, knot); `sleeve(id, d, parent?)`: outlined stroke (`line` 12.5, then `coat` 9, round); `hand(id, x, y, thumb: [number, number], parent?)`; `map(id, at, scale?)`; `sparkle(id, at)`; `question(id, at)` (stroke and dot in `muted`).
- `full-*` figures use a root part `body` (pivot (48, 118)) parenting everything; the head is `lacquerHead("head", [16, 0])`; shoulders are the arm pivots: left (32, 67), right (64, 67).

Tracks (frames at 30 fps; values copied from the approved drawings):

| Figure (intro + idle) | Part · prop | Keys `[frame, value]` |
|---|---|---|
| **full-hello** (90 + 120) — still: left arm raised waving, winking, map in the right hand | armL · rotation | [0,0] [9,-12] [20,14] [31,-12] [42,14] [58,0] [72,0] [90,-112] |
| | winkR · opacity (hold) | [0,100] [72,0] |
| | eyeR · opacity (hold; rest 0) | [0,0] [72,100] |
| | eyes · scale | [0,[100,100]] [198,[100,100]] [203,[100,10]] [208,[100,100]] [210,[100,100]] |
| | body · rotation | [0,0] [90,0] [120,1.2] [180,-1.2] [210,0] |
| **full-lost** (96 + 126) — still: scratching his head, map held up, "?" showing | head · rotation | [0,0] [8,0] [17,-4] [38,-4] [50,4] [71,4] [83,0] |
| | eyes · position | [0,[0,0]] [8,[0,0]] [17,[-2.2,0]] [38,[-2.2,0]] [50,[2.2,0]] [71,[2.2,0]] [83,[0,0]] |
| | armL · rotation | [0,0] [10,5] [19,-2] [29,5] [38,-2] [48,5] [58,-2] [67,0] |
| | question · opacity | [0,100] [77,100] [88,0] |
| | question · position | [0,[0,0]] [24,[0,-1.5]] [48,[0,0]] [72,[0,-1.5]] [88,[0,-2]] |
| | eyes · scale | [0,[100,100]] [209,[100,100]] [214,[100,10]] [219,[100,100]] [222,[100,100]] |
| **head-happy** (48 + 126) — still: eyes ^ ^ | head · position | [0,[0,0]] [10,[0,-6]] [18,[0,0]] |
| | head · scale | [0,[100,100]] [10,[98,103]] [18,[106,93]] [23,[100,100]] |
| | umeboshi · scale | [0,[100,100]] [14,[100,100]] [18,[130,130]] [24,[100,100]] |
| | umeboshi · position | [0,[0,0]] [48,[0,0]] [111,[0,-1.6]] [174,[0,0]] |
| | spark1 · scale & opacity | [0,0] [14,100] [29,100] [48,0] (scale as [v,v]) |
| | spark2 · scale & opacity | [0,0] [10,0] [24,100] [38,100] [48,0] |
| | eyesHappy · opacity (hold) | [0,100] [48,0] |
| | eyes · opacity (hold; rest 0) | [0,0] [48,100] |
| | eyes · scale | [0,[100,100]] [161,[100,100]] [166,[100,10]] [171,[100,100]] [174,[100,100]] |
| **head-hello** (72 + 126) — still: winking | head · rotation | [0,0] [11,-7] [23,6] [35,-4] [45,2] [54,0] |
| | umeboshi · position | [0,[0,0]] [10,[0,-15]] [20,[0,-12]] [35,[0,-12]] [45,[0,-15]] [58,[0,0]] |
| | winkR · opacity (hold) | [0,100] [72,0] |
| | eyeR · opacity (hold; rest 0) | [0,0] [72,100] |
| | eyes · scale | [0,[100,100]] [185,[100,100]] [190,[100,10]] [195,[100,100]] [198,[100,100]] |

Sparkles sit at (66, −2) and (−2, 8) in head coordinates; in `full-*` the "?" sits at (86, 0). Sparkle parts rest at opacity 0 and scale 0 (so the still has none); their tracks therefore start `[0, 0]` / `[0, [0, 0]]` — make the frame-0 test read the rest scale from the part (add `restScale?: number` to `Part`, default 100).

- [ ] **Step 1: Run the existing tests after adding the figure entries but before their parts** — expect failures naming the missing parts.
- [ ] **Step 2: Implement the builders and the four figures.**
- [ ] **Step 3: Generate** — `npm run mascot`; expect five files.
- [ ] **Step 4: Run all tests — expect pass** (frame-0, seams, staleness, sizes under 25 000 bytes); typecheck; lint.
- [ ] **Step 5: Look before moving on** — render all six stills and both themes in a scratch page beside `docs/superpowers/specs/2026-10-19-bento-man/comparison.png` and compare (proportions, coat, sleeves, map, head). Fix any drift.
- [ ] **Step 6: Commit** — "Give Bento Man his body and the rest of his moods".

---

### Task 6: Bento Man in the chat

**Files:**
- Modify: `src/app/trips/[id]/chat.tsx`

**Interfaces:**
- Consumes: `BentoManFigure`, `newlyAccepted`.

- [ ] **Step 1: Header** — `<BentoMark size={28} />` → `<BentoManFigure figure="head-rest" size={28} />`.
- [ ] **Step 2: Replies** — keep a `useRef<Map<string, string | undefined>>` of each message's last proposal status; on every `messages` change, add `newlyAccepted(prev, messages)` to a `celebrating` state set, then refresh the map. Each reply's avatar is `<BentoManFigure key={celebrating.has(m.id) ? "happy" : "rest"} figure={celebrating.has(m.id) ? "head-happy" : "head-rest"} size={24} />`.
- [ ] **Step 3: Empty chat** — in the intro box, wrap `{t.intro}` as `<div className="flex items-start gap-4"><BentoManFigure figure="full-hello" size={88} /><p>…</p></div>`; the "try these" chips stay below.
- [ ] **Step 4: Verify** — typecheck, lint, tests; in the browser (temporary user, owner's approval): accept a proposal → that reply's head jumps once and settles; reload → the accepted reply shows the rest head (no replay).
- [ ] **Step 5: Commit** — "Let Bento Man cheer when a change is accepted".

---

### Task 7: Trips, home, tour, 404 and error pages; docs and credits

**Files:**
- Modify: `src/app/trips/page.tsx`, `src/app/page.tsx` (`DayPreview`), `src/components/tour/tour.tsx`, `src/components/status-page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/copy/en.ts` (`about.credits.body`), `DESIGN.md`, `CLAUDE.md`

- [ ] **Step 1: Trips** — wrap the greeting `<p>` and `<h1>` in `<div className="up mt-8 flex items-center gap-4"><BentoManFigure figure="full-hello" size={72} /><div>…</div></div>` (move `up mt-8` from the `<p>` to the wrapper).
- [ ] **Step 2: Home** — in `DayPreview`'s note tile, `<BentoMark size={22} />` → `<BentoManFigure figure="full-hello" size={64} />` (the figure stays inside the `aria-hidden` illustration).
- [ ] **Step 3: Tour** — above the "Step n of m" line: `<BentoManFigure key={i === 0 ? "hello" : "rest"} figure={i === 0 ? "head-hello" : "head-rest"} size={36} />`.
- [ ] **Step 4: Status pages** — `StatusPage` gains `figure?: ReactNode`, rendered at the top of the section with `mb-4`; `not-found.tsx` and `error.tsx` pass `<BentoManFigure figure="full-lost" size={120} />`.
- [ ] **Step 5: Credits copy** — in `about.credits.body`, "The logo, icons and seasonal illustrations were made for Bento." → "The logo, icons, Bento Man and the seasonal illustrations were made for Bento."
- [ ] **Step 6: Docs** — `DESIGN.md`: a "Bento Man" section (anatomy, colour roles, the five moods, where he appears with sizes, the still-first rule, reduced motion); update the Motion section's loader line to say the loader stays the plain mark. `CLAUDE.md`: "Bento Man's art lives in `src/components/mascot/parts.ts` and `moods.ts`; after changing it run `npm run mascot` — `lottie.test.ts` fails on stale files."
- [ ] **Step 7: Verify** — typecheck, lint, tests, build.
- [ ] **Step 8: Commit** — "Bring Bento Man to the trips, home, tour and error pages".

---

### Task 8: Whole-feature checks

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npm run build` — all pass; record the test count.
- [ ] **Step 2: Browser, 390 px and desktop, light and dark** (temporary user with the owner's approval; delete it afterwards): home, trips (first visit and with a trip), chat (empty, working, accepted), tour first card, `/no-such-page`. Each figure plays once and settles; the console is clean on load (no hydration warning) and after navigating away mid-wave; a chat with many replies requests `/mascot/` only for animated figures.
- [ ] **Step 3: Reduced motion** emulated: stills everywhere; no `lottie_light` or `/mascot/` requests.
- [ ] **Step 4: Blocked player** (`*lottie_light*` blocked): stills stay, no errors.
- [ ] **Step 5: axe** (WCAG 2.2 AA + best practice) on home, trips, chat and 404 in both themes: no new findings.
- [ ] **Step 6: Lighthouse** on the local production build, `/` and `/no-such-page`, against `mascot-baseline.md`: CLS 0, LCP no worse than +100 ms, `/` First Load JS within ~3 KB of baseline.
- [ ] **Step 7:** Remove scratch files and screenshots; fix anything found, with a commit per fix.

---

### Task 9: Pull request

- [ ] **Step 1:** Push the branch; open a PR (problem, behaviour, validation with numbers, screenshots of the moods in light and dark, the hello-every-visit decision). End the body with the two attribution lines from the system reminder.
- [ ] **Step 2:** Comment `@codex review`; wait with `sh scratchpad/codexwait.sh <pr>`; fix findings, push, re-request until clean.
- [ ] **Step 3:** Move the board item to "In review" with the PR link; **ask the owner before merging** (`gh pr merge <n> --merge --match-head-commit <sha>`), then check the Vercel deploy and the live pages, and mark the item Done.
