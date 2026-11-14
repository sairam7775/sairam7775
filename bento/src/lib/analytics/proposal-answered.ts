import { track } from "./client";

export interface ProposalAnswered {
  answer: "accepted" | "rejected";
  proposal_id: string;
  route: boolean;
  dates: boolean;
  days: number;
  verdict: string | null;
}

/** Two parts of a page can see the same answer: the proposal card turning
 *  accepted, and Bookings' landing after a first route. Both report through
 *  one recorder, which sends each answer once per page session. */
export function answeredRecorder(send: (event: string, props: Record<string, string | number | boolean | null>) => void) {
  const sent = new Set<string>();
  return (p: ProposalAnswered) => {
    const key = `${p.proposal_id}:${p.answer}`;
    if (sent.has(key)) return;
    sent.add(key);
    send("proposal_answered", { ...p });
  };
}

export const recordProposalAnswered = answeredRecorder(track);
