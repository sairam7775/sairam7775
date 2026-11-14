import { copy } from "@/copy";
import type { GapReport } from "./gaps";

const t = copy.vault.bentoMan;
const MAX_ASKS = 3;

export interface BentoManTip {
  /** The welcome after a trip's first route, or null. */
  lead: string | null;
  tip: string;
  /** Questions he can take, one per gap: they fill the chat box, never send. */
  asks: { key: string; question: string }[];
}

/** What Bento Man says at the top of Bookings. The gaps arrive most
 *  serious first, so the tip is about the first one. Pure: gaps in, words out. */
export function bentoManTip(report: Pick<GapReport, "gaps" | "dismissed" | "coveredNights" | "totalNights">, opts: { welcome: boolean }): BentoManTip {
  const lead = opts.welcome ? t.welcome : null;
  const asks = report.gaps.flatMap((g) => {
    const q = g.actions.find((a) => a.kind === "ask_bento_man")?.hint;
    return q ? [{ key: g.key, question: q }] : [];
  }).slice(0, MAX_ASKS);

  const first = report.gaps[0];
  if (first) {
    const canHelp = first.actions.some((a) => a.kind === "ask_bento_man");
    return { lead, tip: canHelp ? `${first.title} ${t.offer}` : first.title, asks };
  }
  if (report.totalNights === 0) return { lead, tip: t.noDates, asks };
  // "All covered" only when it is: a dismissed gap is still unbooked.
  const covered = report.dismissed.length === 0 && report.coveredNights >= report.totalNights;
  return { lead, tip: covered ? t.allSet : t.setAside, asks };
}
