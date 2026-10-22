import { describeValue, fieldLabel, sourceHref, suggestion, type ReviewNote, type ReviewerView } from "@/lib/places/review-notes";
import { settleReviewNote } from "./actions";

function Reviewer({ name, view }: { name: string; view: ReviewerView }) {
  const href = sourceHref(view.source);
  return (
    <div className="flex flex-col gap-1">
      <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{name}</span>
      <span className="text-[0.92rem] font-medium">{suggestion(view)}</span>
      {view.note && <span className="text-[0.84rem] leading-relaxed text-ink-2">{view.note}</span>}
      {view.source &&
        (href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="mono break-all text-[0.7rem] text-accent-ink underline underline-offset-2">
            {view.source}
          </a>
        ) : (
          <span className="mono break-all text-[0.7rem] text-ink-3">{view.source}</span>
        ))}
    </div>
  );
}

/** What Codex and Gemini disagree on for one place, each point with the
 *  admin's call and a Settled button. Shown on the review card and in the
 *  editor; `back` is where settling returns to. */
export function ReviewNotes({ notes, back }: { notes: ReviewNote[]; back: string }) {
  if (!notes.length) return null;
  const open = notes.filter((n) => !n.settled_at).length;
  return (
    <section className="border-t border-rule bg-tamago-soft/40 px-6 py-5" aria-labelledby="review-notes">
      <h3 id="review-notes" className="text-base font-bold">
        Reviewers disagree <span className="mono ml-2 text-[0.72rem] font-normal text-ink-3">{open ? `${open} to settle` : "all settled"}</span>
      </h3>
      <p className="mt-1 max-w-xl text-[0.86rem] leading-relaxed text-ink-2">
        Codex and Gemini checked this place against official sites and don&rsquo;t agree on these points. Make your call,
        fix the record or write what it should say, and mark it settled.
      </p>
      <ul className="mt-4 flex flex-col gap-4">
        {notes.map((n) => (
          <li key={n.id} className="border border-rule bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-2.5">
              <span className="font-medium">{fieldLabel(n.field)}</span>
              <span className="mono text-[0.68rem] text-ink-3">
                {n.kind === "disagree" ? "one says it's wrong, one says it's fine" : "both say it's wrong, different fixes"}
              </span>
            </div>
            <div className="grid gap-x-6 gap-y-4 px-4 py-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">Bento has</span>
                <span className="text-[0.92rem] font-medium">{describeValue(n.current)}</span>
              </div>
              <Reviewer name="Codex" view={n.codex} />
              <Reviewer name="Gemini" view={n.gemini} />
            </div>
            {n.settled_at ? (
              <p className="border-t border-rule bg-edamame-soft px-4 py-2.5 text-[0.86rem] text-ink-2">
                Settled by {n.settled_by} on <span className="mono">{n.settled_at.slice(0, 10)}</span>
                {n.decision ? `: ${n.decision}` : "."}
              </p>
            ) : (
              <form action={settleReviewNote} className="flex flex-wrap items-end gap-3 border-t border-rule px-4 py-3">
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="back" value={back} />
                <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
                  <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">Your call (optional)</span>
                  <textarea
                    name="decision"
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. Keep 18:00, put the summer hours in the tip."
                    className="border border-rule bg-surface px-3 py-2 text-[0.88rem] leading-relaxed"
                  />
                </label>
                <button className="min-h-10 border border-rule bg-surface px-4 text-sm font-medium hover:bg-sunk">Settled</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
