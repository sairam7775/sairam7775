/** A question for Bento Man from a button elsewhere on the page (his card
 *  on Bookings, a gap card). The chat puts it in the box and the phone
 *  sheet opens, on every click: a link to the same address would do
 *  neither the second time. Nothing is ever sent for the traveller. */
export const ASK_EVENT = "bento-man:ask";

export function askBentoMan(question: string, target: EventTarget = window): void {
  target.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: question }));
}

/** Listen for questions; returns the function that stops listening. */
export function onAsk(handler: (question: string) => void, target: EventTarget = window): () => void {
  const listener = (e: Event) => {
    const q = (e as CustomEvent).detail;
    if (typeof q === "string" && q) handler(q);
  };
  target.addEventListener(ASK_EVENT, listener);
  return () => target.removeEventListener(ASK_EVENT, listener);
}
