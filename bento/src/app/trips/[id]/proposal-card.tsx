"use client";

import { clock, describeDates, type DayDiff, type Proposal } from "@/lib/bento-man/diff";
import { SubmitButton } from "@/components/form-controls";
import { acceptProposal, rejectProposal } from "./actions";
import { copy } from "@/copy";
import { track } from "@/lib/analytics/client";
import type { CoverageTier } from "@/lib/types";

const t = copy.proposal;

export type ProposalStatus = "proposed" | "accepted" | "rejected";

const CHANGE: Record<DayDiff["after"][number]["change"], { label: string; cls: string }> = {
  kept: { label: t.change.kept, cls: "text-ink-3" },
  added: { label: t.change.added, cls: "bg-edamame-soft text-edamame" },
  moved: { label: t.change.moved, cls: "bg-tamago-soft text-tamago" },
  removed: { label: t.change.removed, cls: "bg-ume-soft text-ume" },
};

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A proposal as the traveller answers it: the day as it would be, each
 *  stop flagged against today, what was left out and why, and two buttons.
 *  Renders from stored data, so it looks the same an hour later. */
/** `cityNames` names every city the chat's proposals mention (from the
 *  catalogue, not just today's route), for days a proposal knows by id. */
export function ProposalCard({ tripId, messageId, proposal, status, cityNames }: { tripId: string; messageId: string; proposal: Proposal; status: ProposalStatus; cityNames: Record<string, string> }) {
  const answered = (answer: "accepted" | "rejected") =>
    track("proposal_answered", { answer, route: Boolean(proposal.route), dates: Boolean(proposal.dates), days: proposal.days.length, verdict: proposal.route?.verdict ?? null });
  const cityName = (id: string) => proposal.route?.after.find((c) => c.cityId === id)?.name ?? cityNames[id] ?? null;
  return (
    <div className="mt-3 overflow-hidden rounded-tile border border-rule bg-paper pop">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-sunk px-4 py-2.5">
        <span className="text-[0.88rem] leading-snug text-ink-2"><span className="font-semibold text-ink">{t.heading}</span> · {proposal.summary}</span>
        {status !== "proposed" && (
          <span className={`mono rounded-full px-2 py-0.5 text-[0.76rem] uppercase tracking-[0.1em] ${status === "accepted" ? "bg-edamame-soft text-edamame" : "bg-ume-soft text-ume"}`}>
            {t.status[status]}
          </span>
        )}
      </div>

      {proposal.dates && (
        <div className="border-b border-rule px-4 py-3">
          <p className="mono text-[0.76rem] uppercase tracking-[0.1em] text-ink-3">{t.dates}</p>
          <p className="mt-1.5 text-[0.92rem]">
            <span className="text-ink-3 line-through decoration-ink-3">{describeDates(proposal.dates.before)}</span>
            <span aria-hidden className="mx-2 text-ink-3">→</span>
            <span className="sr-only">{t.changesTo}</span>
            <span className="font-medium">{describeDates(proposal.dates.after)}</span>
          </p>
          {proposal.dates.after.partySize !== proposal.dates.before.partySize && (
            <p className="mt-1 text-[0.85rem] text-ink-2">{t.travelling(proposal.dates.after.partySize)}</p>
          )}
          <p className="mt-1 text-[0.82rem] text-ink-3">{t.datesNote}</p>
        </div>
      )}

      {proposal.route && (
        <div className="border-b border-rule px-4 py-3">
          <p className="mono text-[0.76rem] uppercase tracking-[0.1em] text-ink-3">{t.route}</p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {proposal.route.after.map((c, i) => (
              <li key={c.cityId} className="flex flex-wrap items-baseline gap-x-2 text-[0.92rem]">
                <span className="mono text-[0.78rem] text-ink-3">{i + 1}.</span>
                <span className="font-medium">{c.name}</span>
                <span className="mono text-[0.78rem] text-ink-3">
                  {c.nights ? copy.trip.nights(c.nights) : t.dayTrip} · {copy.coverage[c.tier as CoverageTier]}
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
            <p className="font-display text-[0.95rem] font-bold">{fmtDate(d.date)} {cityName(d.cityId) && <span className="mono text-[0.76rem] font-normal text-ink-3">{cityName(d.cityId)}</span>}</p>
            <p className="mono text-[0.74rem] text-ink-3">{d.summary}</p>
          </div>
          <ol className="mt-2 flex flex-col gap-2">
            {d.after.map((it) => (
              <li key={it.placeId} className="grid grid-cols-[3.4rem_1fr] gap-x-3 text-[0.9rem]">
                <span className="mono pt-0.5 text-[0.78rem] text-ink-3">{clock(it.startMin)}</span>
                <div>
                  <span className="font-medium">{it.name}</span>
                  {it.locked && <span className="mono ml-2 text-[0.74rem] uppercase tracking-[0.1em] text-accent">{t.pinned}</span>}
                  <span className={`mono ml-2 rounded-full px-1.5 py-0.5 text-[0.74rem] uppercase tracking-[0.1em] ${CHANGE[it.change].cls}`}>{CHANGE[it.change].label}</span>
                  <p className="text-[0.82rem] leading-snug text-ink-2">{it.reason}</p>
                  {it.arriveDetail && <p className="mono mt-0.5 text-[0.78rem] text-ink-3">↳ {it.arriveDetail}</p>}
                </div>
              </li>
            ))}
          </ol>
          {d.removed.length > 0 && (
            <p className="mt-2 text-[0.82rem] text-ink-2">
              {t.out(d.removed.map((r) => r.name).join(", "))}
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
              <summary className="mono cursor-pointer text-[0.78rem] uppercase tracking-[0.1em] text-ink-3">{t.leftOut}</summary>
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
        <div className="flex flex-wrap items-center gap-2 bg-sunk px-4 py-3">
          <form action={acceptProposal} onSubmit={() => answered("accepted")} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <input type="hidden" name="tripId" value={tripId} />
            <input type="hidden" name="messageId" value={messageId} />
            <SubmitButton className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-white hover:bg-accent-deep" pending={t.accepting}>{t.accept}</SubmitButton>
            {proposal.dates && (
              <label className="order-last flex min-h-10 basis-full cursor-pointer items-center gap-2 text-[0.84rem] text-ink-2">
                <input type="checkbox" name="remember" className="size-4 accent-accent" />
                {t.remember}
              </label>
            )}
          </form>
          <form action={rejectProposal} onSubmit={() => answered("rejected")}>
            <input type="hidden" name="tripId" value={tripId} />
            <input type="hidden" name="messageId" value={messageId} />
            <SubmitButton className="min-h-10 rounded-full border border-rule bg-surface px-5 text-[0.9rem] font-medium" pending={t.rejecting}>{t.reject}</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
