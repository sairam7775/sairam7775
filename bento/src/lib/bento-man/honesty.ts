/** The honesty net: a reply that says a change was made or a proposal is
 *  waiting, on a turn that changed and proposed nothing.
 *
 *  Live (eval-outline-r1, 3 of 6 runs), after replan_day refused a place
 *  from another city, Bento Man told the traveller "I have added a day trip
 *  to Miyajima … Please review the new proposal" when no proposal existed.
 *  The model's words can't be fixed in code, but the traveller can be told
 *  the truth after them: chat.ts appends `copy.chat.notChanged`.
 *
 *  Pattern-based, so it is a net, not a guarantee: a paraphrase ("the 28th
 *  is now a Miyajima day") slips through. It reads sentence by sentence and
 *  ignores questions. A negation, offer or condition cancels a claim only
 *  in the claim's own clause, before it ("I don't think I've added it",
 *  "I couldn't add it", "Shall I add it?"), or as its object ("I've changed
 *  nothing"); "I've added it, so you don't need to worry" is still a claim. */

/** The verbs of a change claimed as done, shared by "I have" and a bare "I".
 *  "I planned to …" and "I changed my mind" are not claims. */
const VERBS = String.raw`added|updated|placed|prepared|proposed|planned(?!\s+(?:to|on)\b)|created|built|scheduled|changed(?!\s+my\s+mind\b)|moved|replaced|swapped|re-?planned|drafted|generated|put together|put up|set up`;

/** A change claimed as done: "I have added …", "I've updated …", "I added …". */
const DONE = new RegExp(
  String.raw`(?<!\b(?:if|when|once|before|after|until|unless)\s)\b(?:I've|I have|I)\s+(?:now\s+|just\s+|also\s+|already\s+)?(?:${VERBS})\b`,
  "gi",
);

/** A proposal said to be there for the traveller: "review the new
 *  proposal", "you will find that proposal", "is waiting for your OK". */
const WAITING = [
  /\breview (?:the|your|this|that) (?:new |updated )?(?:proposal|plan|changes?|day)\b/gi,
  /\byou(?:'ll| will) (?:find|see) (?:the|that|this|a|your) (?:new |updated )?(?:proposal|plan|changes?)\b/gi,
  /\b(?:is|are) (?:now |still )?waiting for your\b/gi,
  /\bproposal (?:is )?(?:now )?(?:ready|waiting|pending)\b/gi,
  /\bready for (?:your )?review\b/gi,
  /\b(?:have|got) an? (?:\w+ )?proposal\b/gi,
];

/** Words that make a clause an offer or a condition, not a claim. */
const OFFER = /\b(?:would you like|do you want|shall I|should I|want me to|I can|I could|I'd|I would|I will|I'll|if you|let me know|once you|when you)\b/i;
const NEGATED = /\b(?:not|no|nothing|never|unable|cannot|no longer)\b|n't\b/i;
/** Where a clause starts: punctuation inside a sentence, or a joining word. */
const CLAUSE = /[,;:–—]|\b(?:so|but|and|because|which|while|though|although)\b/gi;
/** A claim whose object is nothing: "I've changed nothing". */
const NONE_AFTER = /^\s+(?:nothing|none|no)\b/i;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** The part of the sentence's clause that comes before `at`. */
function clauseBefore(s: string, at: number): string {
  const before = s.slice(0, at);
  let start = 0;
  for (const m of before.matchAll(CLAUSE)) start = m.index + m[0].length;
  return before.slice(start);
}

/** Whether `re` matches in the sentence as a claim: in a clause with no
 *  negation, offer or condition before it, and (with `noneAfter`) not
 *  followed by "nothing". */
function claimed(s: string, re: RegExp, noneAfter = false): boolean {
  for (const m of s.matchAll(re)) {
    const lead = clauseBefore(s, m.index);
    if (NEGATED.test(lead) || OFFER.test(lead)) continue;
    if (noneAfter && NONE_AFTER.test(s.slice(m.index + m[0].length))) continue;
    return true;
  }
  return false;
}

/** Which claims the reply makes: a change made ("done"), a proposal waiting
 *  for the traveller ("waiting"). */
export function claims(text: string): { done: boolean; waiting: boolean } {
  const said = sentences(text).filter((s) => !s.endsWith("?"));
  return {
    done: said.some((s) => claimed(s, DONE, true)),
    waiting: said.some((s) => WAITING.some((re) => claimed(s, re))),
  };
}

/** Whether the reply claims a change was made ("done") or a proposal is
 *  waiting for the traveller ("waiting"), and which (done first). */
export function claimsChange(text: string): "done" | "waiting" | null {
  const c = claims(text);
  return c.done ? "done" : c.waiting ? "waiting" : null;
}

/** The tools that change the plan or the trip (or propose to). One of them
 *  failing this turn is the evidence a "done" claim is false. */
export const CHANGE_TOOLS: ReadonlySet<string> = new Set(["propose_route", "plan_days", "replan_day", "set_trip_dates", "set_preferences"]);

export interface TurnFacts {
  /** This turn's proposal (`ctx.proposal`). */
  proposed: boolean;
  /** A tool applied something at once this turn (dates, preferences). */
  appliedAtOnce: boolean;
  /** A proposal from an earlier turn still waits for an answer. */
  pendingEarlier: boolean;
  /** A tool in CHANGE_TOOLS returned an error this turn. */
  failedChange: boolean;
}

/** Whether the reply needs `copy.chat.notChanged` after it, on a turn that
 *  neither proposed nor applied anything:
 *  - a proposal said to be waiting when none waits from an earlier turn
 *    either: there is nothing for the traveller to find;
 *  - a change said to be done after a change failed this turn: the live
 *    false claims all came after a refused call.
 *  A "done" claim with no failed change this turn is left alone, whatever
 *  is pending: "I have proposed 3 nights in Kyoto" about the card still
 *  waiting, or "I've updated your preferences" about an earlier turn, are
 *  true, and the pattern can't tell them from a claim the model never
 *  tried to make (that case went untested live; the eval grades it). */
export function needsNotChanged(text: string, turn: TurnFacts): boolean {
  if (turn.proposed || turn.appliedAtOnce) return false;
  const c = claims(text);
  if (c.waiting && !turn.pendingEarlier) return true;
  return c.done && turn.failedChange;
}
