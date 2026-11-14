import { BentoManFigure } from "@/components/mascot/figure";
import type { BentoManTip } from "@/lib/vault/bento-man-tip";
import { copy } from "@/copy";
import { AskLink } from "../ask-link";

const t = copy.vault.bentoMan;

/** Bento Man at the top of Bookings: one tip from what's missing, and a
 *  question per gap he can help with. A question opens his chat with it in
 *  the box (`AskLink`); nothing is sent. */
export function BentoManCard({ tripId, tip }: { tripId: string; tip: BentoManTip }) {
  return (
    <section aria-labelledby="bento-man-tip" className="tile up flex gap-4 px-5 py-4" style={{ animationDelay: ".05s" }}>
      <span className="shrink-0 pt-1"><BentoManFigure figure={tip.lead ? "head-hello" : "head-rest"} size={56} /></span>
      <div className="min-w-0 flex-1">
        <p id="bento-man-tip" className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{t.label}</p>
        {tip.lead && <p className="mt-1.5 text-[0.98rem] font-medium leading-snug">{tip.lead}</p>}
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-2">{tip.tip}</p>
        {tip.asks.length > 0 && (
          <ul aria-label={t.asksLabel} className="mt-3 flex flex-wrap gap-2">
            {tip.asks.map((a) => (
              <li key={a.key}>
                <AskLink
                  href={`/trips/${tripId}/vault?ask=${encodeURIComponent(a.key)}#bento-man`}
                  question={a.question}
                  className="inline-flex min-h-10 items-center rounded-full border border-rule bg-surface px-4 text-left text-[0.84rem] font-medium hover:bg-sunk"
                >
                  {a.question}
                </AskLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
