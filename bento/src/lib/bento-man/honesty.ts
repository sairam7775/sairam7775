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
 *  ignores questions, offers and sentences with a negation in them, so
 *  "Shall I add it?" and "I couldn't add it" never trigger it. */

/** A change claimed as done: "I have added …", "I've updated …". */
const DONE = new RegExp(
  String.raw`(?<!\b(?:if|when|once|before|after|until|unless)\s)\b(?:(?:I've|I have)\s+(?:now\s+|just\s+|also\s+|already\s+)?(?:added|updated|placed|prepared|proposed|planned|created|built|scheduled|changed|moved|replaced|swapped|re-?planned|drafted|generated|put together|put up|set up)|I\s+(?:now\s+|just\s+|also\s+|already\s+)?(?:added|updated|placed|prepared|proposed|scheduled|replaced|swapped|re-?planned|put together))\b`,
  "i",
);

/** A proposal said to be there for the traveller: "review the new
 *  proposal", "you will find that proposal", "is waiting for your OK". */
const WAITING = [
  /\breview (?:the|your|this|that) (?:new |updated )?(?:proposal|plan|changes?|day)\b/i,
  /\byou(?:'ll| will) (?:find|see) (?:the|that|this|a|your) (?:new |updated )?(?:proposal|plan|changes?)\b/i,
  /\b(?:is|are) (?:now |still )?waiting for your\b/i,
  /\bproposal (?:is )?(?:now )?(?:ready|waiting|pending)\b/i,
  /\bready for (?:your )?review\b/i,
  /\b(?:have|got) an? (?:\w+ )?proposal\b/i,
];

/** Sentences that can't be a claim: offers and conditions. */
const OFFER = /\b(?:would you like|do you want|shall I|should I|want me to|I can|I could|I'd|I would|I will|I'll|if you|let me know|once you|when you)\b/i;
const NEGATED = /\b(?:not|nothing|never|unable|cannot|no longer)\b|n't\b/i;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const claimable = (s: string) => !s.endsWith("?") && !OFFER.test(s) && !NEGATED.test(s);

/** Whether the reply claims a change was made ("done") or a proposal is
 *  waiting for the traveller ("waiting"), and which. */
export function claimsChange(text: string): "done" | "waiting" | null {
  const said = sentences(text).filter(claimable);
  if (said.some((s) => DONE.test(s))) return "done";
  if (said.some((s) => WAITING.some((re) => re.test(s)))) return "waiting";
  return null;
}

export interface TurnFacts {
  /** This turn's proposal (`ctx.proposal`). */
  proposed: boolean;
  /** A tool applied something at once this turn (dates, preferences). */
  appliedAtOnce: boolean;
  /** A proposal from an earlier turn still waits for an answer. */
  pendingEarlier: boolean;
}

/** Whether the reply needs `copy.chat.notChanged` after it: it claims a
 *  change, and the turn neither proposed nor applied anything. A proposal
 *  still waiting from an earlier turn makes "it is waiting for your OK"
 *  true, so only a claim of something done this turn counts then. */
export function needsNotChanged(text: string, turn: TurnFacts): boolean {
  if (turn.proposed || turn.appliedAtOnce) return false;
  const claim = claimsChange(text);
  return claim === "done" || (claim === "waiting" && !turn.pendingEarlier);
}
