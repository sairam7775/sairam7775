"use client";

import { useFormStatus } from "react-dom";
import { clock, type DayDiff, type Proposal } from "@/lib/bento-man/diff";
import { acceptProposal, rejectProposal } from "./actions";

export type ProposalStatus = "proposed" | "accepted" | "rejected";

const CHANGE: Record<DayDiff["after"][number]["change"], { label: string; cls: string }> = {
  kept: { label: "kept", cls: "text-ink-3" },
  added: { label: "new", cls: "bg-edamame-soft text-edamame" },
  moved: { label: "moved", cls: "bg-tamago-soft text-tamago" },
  removed: { label: "out", cls: "bg-ume-soft text-ume" },
};

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A proposal as the traveller answers it: the day as it would be, each
 *  stop flagged against today, what was left out and why, and two buttons.
 *  Renders from stored data, so it looks the same an hour later. */
export function ProposalCard({ tripId, messageId, proposal, status }: { tripId: string; messageId: string; proposal: Proposal; status: ProposalStatus }) {
  return (
    <div className="mt-3 overflow-hidden rounded-tile border border-rule bg-paper pop">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-sunk px-4 py-2.5">
        <span className="mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-3">Proposal · {proposal.summary}</span>
        {status !== "proposed" && (
          <span className={`mono rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.1em] ${status === "accepted" ? "bg-edamame-soft text-edamame" : "bg-ume-soft text-ume"}`}>
            {status}
          </span>
        )}
      </div>

      {proposal.route && (
        <div className="border-b border-rule px-4 py-3">
          <p className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">Route</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {proposal.route.after.map((c, i) => (
              <li key={c.cityId} className="flex flex-wrap items-baseline gap-x-2 text-[0.92rem]">
                <span className="mono text-[0.72rem] text-ink-3">{i + 1}.</span>
                <span className="font-medium">{c.name}</span>
                <span className="mono text-[0.72rem] text-ink-3">
                  {c.nights ? `${c.nights} night${c.nights === 1 ? "" : "s"}` : "day trip"} · {c.tier}
                  {c.arriveDate ? ` · ${fmtDate(c.arriveDate)}` : ""}
                </span>
                {c.reason && <span className="basis-full text-[0.85rem] text-ink-2">{c.reason}</span>}
              </li>
            ))}
          </ol>
          <p className={`mt-2 text-[0.85rem] ${proposal.route.verdict === "overpacked" ? "text-ume" : proposal.route.verdict === "tight" ? "text-tamago" : "text-ink-2"}`}>
            {proposal.route.arithmetic}
          </p>
        </div>
      )}

      {proposal.days.map((d) => (
        <div key={d.date} className="border-b border-rule px-4 py-3 last:border-b-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-[0.95rem] font-bold">{fmtDate(d.date)} <span className="mono text-[0.7rem] font-normal text-ink-3">{d.cityId}</span></p>
            <p className="mono text-[0.68rem] text-ink-3">{d.summary}</p>
          </div>
          <ol className="mt-2 flex flex-col gap-2">
            {d.after.map((it) => (
              <li key={it.placeId} className="grid grid-cols-[3.4rem_1fr] gap-x-3 text-[0.9rem]">
                <span className="mono pt-0.5 text-[0.72rem] text-ink-3">{clock(it.startMin)}</span>
                <div>
                  <span className="font-medium">{it.name}</span>
                  {it.locked && <span className="mono ml-2 text-[0.6rem] uppercase tracking-[0.1em] text-accent">pinned</span>}
                  <span className={`mono ml-2 rounded-full px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] ${CHANGE[it.change].cls}`}>{CHANGE[it.change].label}</span>
                  <p className="text-[0.82rem] leading-snug text-ink-2">{it.reason}</p>
                  {it.arriveDetail && <p className="mono mt-0.5 text-[0.66rem] text-ink-3">↳ {it.arriveDetail}</p>}
                </div>
              </li>
            ))}
          </ol>
          {d.removed.length > 0 && (
            <p className="mt-2 text-[0.82rem] text-ink-2">
              Out: {d.removed.map((r) => r.name).join(", ")}
            </p>
          )}
          {d.warnings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {d.warnings.map((w) => (
                <li key={w} className="border-l-[3px] border-tamago bg-tamago-soft px-3 py-1.5 text-[0.8rem] text-ink-2">{w}</li>
              ))}
            </ul>
          )}
          {d.considered.length > 0 && (
            <details className="mt-2">
              <summary className="mono cursor-pointer text-[0.66rem] uppercase tracking-[0.1em] text-ink-3">Left out, and why</summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {d.considered.map((c) => (
                  <li key={c.name} className="text-[0.8rem] text-ink-2"><span className="font-medium text-ink">{c.name}</span> — {c.detail}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {status === "proposed" && (
        <div className="flex gap-2 bg-sunk px-4 py-3">
          <form action={acceptProposal}>
            <input type="hidden" name="tripId" value={tripId} />
            <input type="hidden" name="messageId" value={messageId} />
            <Submit className="rounded-full bg-accent px-4 py-1.5 text-[0.85rem] font-medium text-white hover:bg-accent-deep" label="Accept" pendingLabel="Applying…" />
          </form>
          <form action={rejectProposal}>
            <input type="hidden" name="tripId" value={tripId} />
            <input type="hidden" name="messageId" value={messageId} />
            <Submit className="rounded-full border border-rule bg-surface px-4 py-1.5 text-[0.85rem] font-medium" label="Reject" pendingLabel="…" />
          </form>
        </div>
      )}
    </div>
  );
}

/** One submit at a time: a double click must not apply a proposal twice. */
function Submit({ className, label, pendingLabel }: { className: string; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
