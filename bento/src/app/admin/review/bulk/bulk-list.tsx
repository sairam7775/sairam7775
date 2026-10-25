"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton } from "@/components/form-controls";
import { verifyPlaces } from "../../actions";

export interface BulkDraft {
  id: string;
  name: string;
  cityName: string;
  duration: number | null;
  tags: string;
  /** What it lacks before it can be signed; empty when ready. */
  missing: string[];
  /** Open points the AI reviewers disagree on (0025). */
  disputes: number;
}

/** The ticking half of the bulk page. Native checkboxes post the ids, so
 *  the server sees exactly what was ticked; the state only drives "select
 *  all" and the count in the confirm. Records that aren't ready can't be
 *  ticked, and the server checks again either way. */
export function BulkList({ drafts, back }: { drafts: BulkDraft[]; back: string }) {
  const ready = drafts.filter((d) => d.missing.length === 0);
  const [chosen, setPicked] = useState<Set<string>>(new Set());
  // Only what is still on the page: a verified record drops off the list.
  const picked = new Set(ready.filter((d) => chosen.has(d.id)).map((d) => d.id));
  const allPicked = ready.length > 0 && ready.every((d) => picked.has(d.id));

  const toggle = (id: string) =>
    setPicked(() => {
      const next = new Set(picked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={verifyPlaces} className="mt-6">
      <input type="hidden" name="back" value={back} />
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border border-rule bg-surface px-4 py-3">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[0.9rem]">
          <input
            type="checkbox"
            className="size-4 accent-edamame"
            checked={allPicked}
            disabled={!ready.length}
            onChange={() => setPicked(allPicked ? new Set() : new Set(ready.map((d) => d.id)))}
          />
          Select all ready ({ready.length})
        </label>
        <span className="mono text-[0.7rem] text-ink-3">{drafts.length - ready.length} need fixing first</span>
        <ConfirmButton
          disabled={!picked.size}
          message={`Verify ${picked.size} place${picked.size === 1 ? "" : "s"} as you? Each becomes visible to travellers and Bento Man straight away, signed with your name. Editing one later returns it to draft.`}
          className="ml-auto min-h-10 bg-edamame px-5 text-sm font-medium text-surface"
        >
          Verify {picked.size || ""} selected
        </ConfirmButton>
      </div>

      <ul className="border-x border-b border-rule bg-surface">
        {drafts.map((d) => {
          const ok = d.missing.length === 0;
          return (
            <li key={d.id} className="flex items-start gap-3 border-t border-rule px-4 py-3 first:border-t-0">
              <input
                type="checkbox"
                name="ids"
                value={d.id}
                aria-label={`Verify ${d.name}`}
                className="mt-1 size-4 shrink-0 accent-edamame"
                disabled={!ok}
                checked={picked.has(d.id)}
                onChange={() => toggle(d.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`/admin/places/${d.id}`} className="font-medium underline-offset-2 hover:underline">{d.name}</Link>
                  <span className="mono text-[0.7rem] text-ink-3">{d.cityName}</span>
                  {d.duration != null && <span className="mono text-[0.7rem] text-ink-3">{d.duration} min</span>}
                </div>
                {d.tags && <p className="mt-0.5 text-[0.82rem] text-ink-2">{d.tags}</p>}
                {!ok && <p className="mt-0.5 text-[0.8rem] text-ume">Needs {d.missing.join(", ")} — open it to fill in.</p>}
                {d.disputes > 0 && (
                  <p className="mt-0.5 text-[0.8rem] text-tamago">
                    The reviewers disagree on {d.disputes} point{d.disputes === 1 ? "" : "s"} —{" "}
                    <Link href={`/admin/places/${d.id}`} className="underline underline-offset-2">settle {d.disputes === 1 ? "it" : "them"} first</Link>.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
