"use client";

import { useEffect } from "react";
import { recordProposalAnswered, type ProposalAnswered } from "@/lib/analytics/proposal-answered";

/** Bookings after a first route accepted on the plan page: records the
 *  answer the card there had no time to (once, shared with the card's own
 *  report), then takes `accepted` out of the address so a reload doesn't. */
export function TrackAccepted({ answer }: { answer: ProposalAnswered }) {
  const key = JSON.stringify(answer);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("accepted")) return;
    recordProposalAnswered(JSON.parse(key));
    url.searchParams.delete("accepted");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [key]);
  return null;
}
