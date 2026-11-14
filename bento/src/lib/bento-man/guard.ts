/** Defences around the model that hold even when it doesn't obey the prompt.
 *
 *  The prompt keeps Bento Man on Japan and tells it the traveller's words
 *  are things to help with, not instructions. These make the cheap attacks
 *  fail anyway. On the way in, characters the traveller can't see are
 *  removed: control characters, zero-width and direction marks, and Unicode
 *  tag characters, which can carry a whole hidden instruction. Tags that
 *  look like Bento's own framing are defused, so a message can't forge trip
 *  state. On the way out, a reply that repeats the system prompt is withheld.
 *
 *  This file is plain ASCII on purpose (a test checks it): every character
 *  it strips is named below by its code point, so it can be reviewed. */

import { SYSTEM_PROMPT } from "./prompt";

/** Code point ranges removed from what the traveller typed, inclusive.
 *  Tab (09), newline (0A) and carriage return (0D) stay. So do the
 *  zero-width non-joiner and joiner (200C, 200D): Hindi, Telugu, Persian
 *  and other scripts need them to be written correctly, emoji sequences
 *  are built with 200D, and the cleaned text is what gets stored. */
const STRIPPED: [number, number][] = [
  [0x0000, 0x0008], // C0 controls before tab
  [0x000b, 0x000c], // vertical tab, form feed
  [0x000e, 0x001f], // the rest of C0
  [0x007f, 0x007f], // DEL
  [0x00ad, 0x00ad], // soft hyphen
  [0x061c, 0x061c], // Arabic letter mark (a direction mark)
  [0x200b, 0x200b], // zero-width space
  [0x200e, 0x200f], // left-to-right and right-to-left marks
  [0x202a, 0x202e], // bidi embeddings, pop and overrides
  [0x2060, 0x2064], // word joiner and invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // byte order mark / zero-width no-break space
  [0xe0000, 0xe007f], // Unicode tag characters
];

const u = (point: number) => `\\u{${point.toString(16)}}`;
const INVISIBLE = new RegExp(`[${STRIPPED.map(([from, to]) => `${u(from)}-${u(to)}`).join("")}]`, "gu");

/** The joiners kept above. With whitespace, they may sit between the letters
 *  of a framing name without hiding it from the checks below. */
const JOINER = `[${u(0x200c)}${u(0x200d)}]`;
const GAP = `[\\s${u(0x200c)}${u(0x200d)}]*`;

/** One letter of a framing name, in either case, ASCII or full-width
 *  (U+FF21-FF3A, U+FF41-FF5A). */
const letter = (c: string) => {
  const upper = c.toUpperCase().charCodeAt(0);
  const lower = c.toLowerCase().charCodeAt(0);
  return `[${c.toLowerCase()}${c.toUpperCase()}${u(0xff21 + upper - 0x41)}${u(0xff41 + lower - 0x61)}]`;
};
/** A framing name however it is spelled: case, full-width letters, and
 *  whitespace, newlines or joiners between the letters and around the
 *  underscore (ASCII or full-width, U+FF3F). */
const spelled = (name: string) =>
  name.split("_").map((part) => [...part].map(letter).join(GAP)).join(`${GAP}[_${u(0xff3f)}]${GAP}`);
const NAME = `(?:${spelled("trip_state")}|${spelled("traveller_message")})`;
const NAMES = new RegExp(NAME, "gu");

/** A real tag around a framing name. Its angle brackets are swapped too. */
const FRAMING = new RegExp(`<\\s*\\/?${GAP}${NAME}[^>]*>`, "gu");
const JOINER_RUN = new RegExp(`${JOINER}+`, "gu");
/** Look-alike angle brackets (U+2039, U+203A) for a defused tag. */
const OPEN = String.fromCodePoint(0x2039);
const CLOSE = String.fromCodePoint(0x203a);

/** A framing name broken so nobody reads it as one: the underscore becomes
 *  a space, whatever is in front of it (<, &lt;, a full-width bracket). */
const broken = (name: string) =>
  (name.normalize("NFKC").toLowerCase().replace(/[^a-z]/g, "").startsWith("trip") ? "trip state" : "traveller message");

/** Text from outside Bento's own code, made safe to put in front of the
 *  model: what the traveller typed, stored rows, tool results. */
export function clean(text: string): string {
  return text
    .replace(INVISIBLE, "")
    .replace(FRAMING, (tag) => tag.replace(JOINER_RUN, "").replace(/</g, OPEN).replace(/>/g, CLOSE))
    .replace(NAMES, broken);
}

/** Every string in a value cleaned; keys and structure untouched. */
function cleanStrings(value: unknown): unknown {
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map(cleanStrings);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanStrings(v)]));
  return value;
}

/** A tool result (a JSON string, or plain text when a tool failed) as the
 *  model should read it: its strings can hold what a traveller stored, so
 *  they are cleaned. A result that needs no change is returned as the same
 *  string, so ordinary results stay byte-identical (cache and cost). */
export function cleanToolResult(result: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(result);
  } catch {
    return clean(result);
  }
  const cleaned = JSON.stringify(cleanStrings(parsed));
  return cleaned === JSON.stringify(parsed) ? result : cleaned;
}

/** This turn's message as the model sees it: after the trip state, inside
 *  the tag the prompt names as the traveller's own words. */
export const travellerMessage = (message: string) => `<traveller_message>\n${message}\n</traveller_message>`;

/* ------------------------------------------------------------ leaks
 * A reply leaks the prompt when it holds LEAK_RUN or more consecutive
 * words of it. Both sides are compared as plain words: lower-case, NFKC,
 * with markdown, punctuation, quotes and invisible characters gone, so bold
 * per word, a zero-width space before each space, line breaks, quoting or
 * bullets change nothing.
 *
 * LEAK_RUN = 8, from evidence (scratch analysis, 14 Nov 2026): it catches
 * every prompt sentence of eight or more words, and the longest run of
 * prompt words in 25 ordinary replies and 13 live-eval replies was 7
 * ("Three short paragraphs beat one long one", in advice about writing to
 * a hotel). Shorter prompt sentences ("The gap is the information.") are
 * not caught on their own.
 *
 * What the prompt quotes for him to say ("..." spans, and the lines under
 * "Examples of the register") is exempt: a run counts only when at least
 * half its words come from outside those quotes. */
export const LEAK_RUN = 8;
const HALF = Math.ceil(LEAK_RUN / 2);

const IGNORABLE = `[${STRIPPED.map(([from, to]) => `${u(from)}-${u(to)}`).join("")}${u(0x200c)}${u(0x200d)}]`;
const TOKEN = new RegExp(`[\\p{L}\\p{N}](?:[\\p{L}\\p{N}]|${IGNORABLE})*`, "gu");
const IGNORABLE_ALL = new RegExp(IGNORABLE, "gu");

interface Token { word: string; start: number; end: number }
function tokens(text: string): Token[] {
  return [...text.matchAll(TOKEN)].map((m) => ({
    word: m[0].replace(IGNORABLE_ALL, "").normalize("NFKC").toLowerCase(),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** Character ranges of the prompt he is meant to say. */
const SAYABLE: [number, number][] = [
  ...[...SYSTEM_PROMPT.matchAll(/"[^"\n]+"/g)].map((m): [number, number] => [m.index, m.index + m[0].length]),
  [SYSTEM_PROMPT.indexOf("Examples of the register:"), SYSTEM_PROMPT.length],
];
const PROMPT_TOKENS = tokens(SYSTEM_PROMPT).map((t) => ({ ...t, sayable: SAYABLE.some(([a, b]) => t.start >= a && t.start < b) }));

/** Every run of LEAK_RUN prompt words that counts as a leak, and every
 *  shorter start of one (for holding a streaming tail back). */
const LEAKS = new Set<string>();
const STARTS = new Set<string>();
for (let i = 0; i + LEAK_RUN <= PROMPT_TOKENS.length; i++) {
  const run = PROMPT_TOKENS.slice(i, i + LEAK_RUN);
  if (run.filter((t) => !t.sayable).length < HALF) continue;
  const runWords = run.map((t) => t.word);
  LEAKS.add(runWords.join(" "));
  for (let k = 1; k < LEAK_RUN; k++) STARTS.add(runWords.slice(0, k).join(" "));
}

/** True when a reply repeats LEAK_RUN or more consecutive words of the
 *  prompt, outside what the prompt quotes for him to say. */
export function leaksPrompt(text: string): boolean {
  const words = tokens(text).map((t) => t.word);
  for (let i = 0; i + LEAK_RUN <= words.length; i++) if (LEAKS.has(words.slice(i, i + LEAK_RUN).join(" "))) return true;
  return false;
}

/** How much of a reply still streaming may be shown: everything before the
 *  trailing words that could be the start of a leak, and before a word
 *  still being written. `ended` says no more text follows directly (the end
 *  of a model call), so the last word is whole. The finished reply replaces
 *  the stream, so what is held is never lost. */
/** A single word is not a recognisable piece of the prompt (most of its
 *  words are everyday ones), so runs of one are not held. */
const MIN_HELD = 2;

export function releasable(text: string, ended = false): number {
  const all = tokens(text);
  let held = text.length;
  let whole = all;
  const last = all.at(-1);
  if (!ended && last && last.end === text.length) {
    held = last.start;
    whole = all.slice(0, -1);
  }
  for (let k = Math.min(LEAK_RUN - 1, whole.length); k >= MIN_HELD; k--) {
    if (STARTS.has(whole.slice(-k).map((t) => t.word).join(" "))) {
      held = Math.min(held, whole[whole.length - k].start);
      break;
    }
  }
  return held;
}

/** A reply as it streams to the browser, across every model call of a
 *  turn. It keeps one text, joined between calls the way the final reply is
 *  joined, so a run of prompt words split by a tool round is still one run.
 *  It sends on only what can't be the start of a leak, stops for good once
 *  the text leaks, and holds a call's trailing words through a tool round
 *  when they could continue into the next call. Whatever it holds back, the
 *  final reply replaces the stream on "done"; if the turn fails instead,
 *  the browser keeps only text that passed the check. */
export class GuardedStream {
  private text = "";
  private shown = 0;
  /** Joins between calls: part of the checked text, never sent (the chat
   *  adds its own break after a tool round). */
  private joins: [number, number][] = [];
  private inCall = false;
  private stopped = false;
  /** The text leaked: the turn's reply must be withheld. */
  withheld = false;

  constructor(private readonly emit: (delta: string) => void, private readonly join = "\n\n") {}

  push(delta: string) {
    if (this.withheld || this.stopped || !delta) return;
    if (!this.inCall) {
      this.inCall = true;
      if (this.text.trim()) {
        this.joins.push([this.text.length, this.text.length + this.join.length]);
        this.text += this.join;
      }
    }
    this.text += delta;
    if (leaksPrompt(this.text)) this.withheld = true;
    else this.show(releasable(this.text));
  }

  /** A model call finished: its last word is whole. */
  endCall() {
    this.inCall = false;
    if (!this.withheld && !this.stopped) this.show(releasable(this.text, true));
  }

  /** Send nothing more this turn (the reply is being replaced anyway). */
  stop() {
    this.stopped = true;
  }

  private show(upTo: number) {
    if (upTo <= this.shown) return;
    let out = "";
    let i = this.shown;
    for (const [a, b] of this.joins) {
      if (b <= i || a >= upTo) continue;
      if (a > i) out += this.text.slice(i, a);
      i = Math.max(i, b);
    }
    if (i < upTo) out += this.text.slice(i, upTo);
    this.shown = upTo;
    if (out) this.emit(out);
  }
}
