"use client";

import { useState, useTransition, type DragEvent } from "react";
import { moveItem, removeItem, reorderDay, replanDayAction, togglePin } from "./day-actions";

export interface DayBoxItem {
  placeId: string;
  name: string;
  startMin: number | null;
  durationMin: number | null;
  locked: boolean;
  reason: string | null;
  reasonTerms: string[];
  arriveMode: string | null;
  arriveMinutes: number | null;
  arriveDetail: string | null;
}

export interface DayBoxProps {
  tripId: string;
  date: string;
  cityId: string;
  cityName: string;
  tier: string;
  items: DayBoxItem[];
  budgetMin: number;
  activeMin: number;
  overBy: number;
  overFromIndex: number | null;
  lunch: { startMin: number; endMin: number } | null;
  editable: boolean;
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

/** Compartment colours cycle through the box: salmon, edamame, lavender,
 *  tamago, plain. Enough to tell stops apart at a glance, never a code. */
const FILLS = ["bg-accent-soft", "bg-edamame-soft", "bg-lavender-soft", "bg-tamago-soft", "bg-surface"];
/** Height is time. 1.05px a minute, floored so a 15-minute stop is still readable. */
const PX_PER_MIN = 1.05;
const MIN_TILE = 88;

const TERM_LABEL: Record<string, string> = {
  interest_match: "your interests",
  signature: "signature",
  season_fit: "in season",
  discovery_fit: "off the list",
  crowd: "quiet hours",
  redundancy: "variety",
  energy: "easy going",
  budget_strain: "budget",
  pace_strain: "pace",
  confidence: "verified",
  skip_if: "flagged",
};

/** A day is a bento box. Compartments are sized to the time each stop
 *  takes, so an over-packed day looks over-packed before you read a word.
 *  Drag reorders; pin and remove apply at once and the engine re-times
 *  the day. Re-plan asks the engine to choose again around the pins. */
export function DayBox(p: DayBoxProps) {
  const [order, setOrder] = useState(p.items.map((i) => i.placeId));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(p.items.map((i) => [i.placeId, i]));
  // The optimistic order, plus anything the server added since (an accepted
  // proposal, say) so a stop never silently disappears from the box.
  const items = [
    ...order.map((id) => byId.get(id)).filter((i): i is DayBoxItem => Boolean(i)),
    ...p.items.filter((i) => !order.includes(i.placeId)),
  ];
  const fillPct = Math.min(100, Math.round((p.activeMin / p.budgetMin) * 100));
  const lunchBeforeIndex = p.lunch ? items.findIndex((it) => it.startMin != null && it.startMin >= p.lunch!.endMin) : -1;

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;
    const next = order.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId), 0, dragging);
    setOrder(next);
    setDragging(null);
    setOver(null);
    const fd = new FormData();
    fd.set("tripId", p.tripId);
    fd.set("date", p.date);
    fd.set("order", JSON.stringify(next));
    start(() => reorderDay(fd));
  }

  const hidden = (
    <>
      <input type="hidden" name="tripId" value={p.tripId} />
      <input type="hidden" name="date" value={p.date} />
    </>
  );

  return (
    <div className={`box up p-3 sm:p-3.5 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_236px]">
        <div className="flex flex-col gap-2.5">
          {items.length === 0 && (
            <div className="tile px-5 py-8 text-center text-[0.92rem] text-ink-2">
              Nothing in this box yet. Ask Bento Man to plan {p.cityName}, or re-plan the day.
            </div>
          )}

          {items.map((it, i) => {
            const isOver = p.overFromIndex != null && i >= p.overFromIndex;
            const showLunchBefore = i === lunchBeforeIndex;
            const height = Math.max(MIN_TILE, (it.durationMin ?? 60) * PX_PER_MIN);
            return (
              <div key={it.placeId} className="contents">
                {i > 0 && it.arriveDetail && (
                  <div className="up flex justify-center px-2" style={{ animationDelay: `${0.06 * i}s` }}>
                    <span className="mono inline-flex items-center gap-2 text-[0.68rem] text-rice/85">
                      <span aria-hidden className="inline-block h-[1px] w-4 bg-rice/40" />
                      {it.arriveDetail}
                      {it.arriveMinutes != null && <span className="text-rice/60">· {it.arriveMinutes} min</span>}
                    </span>
                  </div>
                )}
                {showLunchBefore && p.lunch && (
                  <div className="tile up flex gap-4 bg-tamago-soft px-4 py-3" style={{ animationDelay: `${0.06 * i}s` }}>
                    <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{clock(p.lunch.startMin)}</span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="disp text-[1.05rem] font-bold">Lunch</span>
                        <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(p.lunch.endMin - p.lunch.startMin)}</span>
                      </div>
                      <p className="mt-0.5 text-[0.85rem] text-ink-2">Nothing booked, and nothing needs to be. Bring cash.</p>
                    </div>
                  </div>
                )}
                {p.overFromIndex === i && (
                  <div className="flex items-center gap-3 px-2" role="separator" aria-label="Day budget ends here">
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                    <span className="mono pop rounded-full bg-accent px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.1em] text-white">{dur(p.budgetMin)} day ends here</span>
                    <span className="h-[2px] flex-1 bg-accent/80" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 6px, var(--color-lacquer) 6px 12px)" }} />
                  </div>
                )}
                <div
                  draggable={p.editable}
                  onDragStart={() => setDragging(it.placeId)}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onDragOver={(e) => { e.preventDefault(); if (over !== it.placeId) setOver(it.placeId); }}
                  onDragLeave={() => setOver((o) => (o === it.placeId ? null : o))}
                  onDrop={(e) => onDrop(e, it.placeId)}
                  style={{ minHeight: height, animationDelay: `${0.08 * i + 0.1}s` }}
                  className={`tile up lift relative flex gap-4 px-4 py-3.5 sm:px-5 ${FILLS[i % FILLS.length]} ${isOver ? "ring-2 ring-ume/70" : ""} ${dragging === it.placeId ? "opacity-40" : ""} ${over === it.placeId && dragging && dragging !== it.placeId ? "ring-2 ring-accent" : ""} ${p.editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <span className="mono w-11 shrink-0 pt-0.5 text-[0.8rem] text-ink-2">{it.startMin != null ? clock(it.startMin) : "--:--"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="disp text-[1.15rem] font-bold leading-tight">{it.name}</span>
                      {it.locked && (
                        <span className="mono pop inline-flex items-center gap-1.5 rounded-full bg-lacquer px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-rice" style={{ animationDelay: ".5s" }}>
                          <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
                          pinned
                        </span>
                      )}
                      {isOver && <span className="mono rounded-full bg-ume-soft px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em] text-ume">over</span>}
                      {it.durationMin != null && <span className="mono ml-auto text-[0.7rem] text-ink-3">{dur(it.durationMin)}</span>}
                    </div>
                    {it.reason && <p className="mt-1 text-[0.86rem] leading-snug text-ink-2">{it.reason}</p>}
                    {it.reasonTerms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.reasonTerms.slice(0, 4).map((t) => (
                          <span key={t} className="mono rounded-full bg-ink/8 px-2 py-0.5 text-[0.6rem] text-ink-2">{TERM_LABEL[t] ?? t.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    )}
                    {p.editable && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <form action={togglePin}>{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <button className="mono rounded-full border border-ink/15 px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.08em] text-ink-2 hover:border-ink/40" title={it.locked ? "Let the engine move this" : "Keep this exactly here"}>{it.locked ? "unpin" : "pin"}</button>
                        </form>
                        <form action={moveItem}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="up" />
                          <button className="mono rounded-full border border-ink/15 px-2 py-1 text-[0.64rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={i === 0} aria-label="Move earlier">↑</button>
                        </form>
                        <form action={moveItem}>{hidden}<input type="hidden" name="placeId" value={it.placeId} /><input type="hidden" name="dir" value="down" />
                          <button className="mono rounded-full border border-ink/15 px-2 py-1 text-[0.64rem] text-ink-2 hover:border-ink/40 disabled:opacity-30" disabled={i === items.length - 1} aria-label="Move later">↓</button>
                        </form>
                        <form action={removeItem} className="ml-auto">{hidden}<input type="hidden" name="placeId" value={it.placeId} />
                          <button className="mono rounded-full px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.08em] text-ink-3 hover:bg-ume-soft hover:text-ume">remove</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="flex flex-col gap-2.5">
          <div className="tile up px-4 py-4" style={{ animationDelay: ".2s" }}>
            <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">Day budget</span>
            <div className="mt-3 flex items-center gap-4">
              <Ring pct={fillPct} over={p.overBy > 0} />
              <div>
                <span className="disp block text-[1.35rem] font-extrabold leading-none">{dur(p.activeMin)}</span>
                <span className="mono mt-1 block text-[0.7rem] text-ink-3">of {dur(p.budgetMin)}</span>
                {p.overBy > 0 ? (
                  <span className="mono mt-1.5 block text-[0.7rem] text-ume">{dur(p.overBy)} over</span>
                ) : (
                  <span className="mono mt-1.5 block text-[0.7rem] text-edamame">{dur(p.budgetMin - p.activeMin)} slack</span>
                )}
              </div>
            </div>
          </div>

          <div className="tile up px-4 py-4" style={{ animationDelay: ".28s" }}>
            <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{p.cityName} · {p.tier}</span>
            <p className="mt-2 text-[0.85rem] leading-snug text-ink-2">
              {items.filter((i) => i.locked).length ? `${items.filter((i) => i.locked).length} pinned. ` : ""}
              Drag to reorder, pin what must stay, remove what you don&rsquo;t want. Times follow.
            </p>
            {p.editable && (
              <form action={replanDayAction} className="mt-3">
                {hidden}
                <button className="w-full rounded-full bg-lacquer px-4 py-2 text-[0.85rem] font-medium text-rice hover:bg-ink-2">Re-plan this day</button>
                <p className="mono mt-2 text-[0.64rem] leading-snug text-ink-3">The engine chooses again around your pins. Comes back as a proposal you can reject.</p>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Ring({ pct, over }: { pct: number; over: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = c * (pct / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-label={`${pct}% of the day`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-rule)" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={r} fill="none"
        stroke={over ? "var(--color-ume)" : "var(--color-accent)"}
        strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 38 38)"
        className="ring"
        style={{ ["--ring-full" as string]: `${c}` } as React.CSSProperties}
      />
      <text x="38" y="42" textAnchor="middle" className="mono" fontSize="13" fill="currentColor">{pct}%</text>
    </svg>
  );
}
