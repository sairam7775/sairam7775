import type { Gap, GapSeverity, NightCoverage } from "@/lib/vault/gaps";
import { dismissGap, restoreGap } from "./actions";

const SEVERITY: Record<GapSeverity, { label: string; tile: string; label_cls: string }> = {
  blocking: { label: "Blocking", tile: "bg-ume-soft", label_cls: "text-ume" },
  closing: { label: "Closing", tile: "bg-tamago-soft", label_cls: "text-tamago" },
  worth_knowing: { label: "Worth knowing", tile: "bg-surface", label_cls: "text-ink-3" },
};

const dayNum = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });

/** One bar per night, solid where covered and hatched where not, so the
 *  gap is visible before a word is read (§11). */
export function CoverageRibbon({ nights, covered }: { nights: NightCoverage[]; covered: number }) {
  if (!nights.length) {
    return (
      <div className="box up px-5 py-6">
        <p className="text-[0.92rem] text-rice/80">No dates on this trip yet, so there are no nights to cover. Tell Bento Man when you are going.</p>
      </div>
    );
  }
  const first = nights[0].date;
  const last = nights[nights.length - 1].date;
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  // One label per stretch of the same city, laid over the same grid.
  const runs: { cityName: string | null; span: number }[] = [];
  for (const n of nights) {
    const tail = runs[runs.length - 1];
    if (tail && tail.cityName === n.cityName) tail.span += 1;
    else runs.push({ cityName: n.cityName, span: 1 });
  }

  return (
    <div className="box up px-4 py-4 sm:px-5" style={{ animationDelay: ".1s" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-rice/70">Where you sleep · {fmt(first)}–{fmt(last)}</span>
        <span className="mono text-[0.62rem] text-rice/70">{covered} of {nights.length} nights covered</span>
      </div>

      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nights.length}, minmax(0, 1fr))` }}>
        {nights.map((n, i) =>
          n.covered ? (
            <span
              key={n.date}
              title={`${n.date}: ${n.bookingTitle}`}
              className="grow h-11 rounded-xl bg-edamame"
              style={{ animationDelay: `${0.25 + i * 0.05}s` }}
            />
          ) : (
            <span
              key={n.date}
              title={`${n.date}: nothing booked`}
              className="pop h-11 rounded-xl border-2 border-ume"
              style={{
                animationDelay: `${0.5 + i * 0.03}s`,
                backgroundImage: "repeating-linear-gradient(-45deg, var(--color-ume) 0 6px, transparent 6px 12px)",
              }}
            />
          ),
        )}
      </div>

      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nights.length}, minmax(0, 1fr))` }}>
        {nights.map((n) => (
          <span key={n.date} className={`mono text-center text-[0.62rem] ${n.covered ? "text-rice/60" : "font-medium text-ume"}`}>
            {dayNum(n.date)}
          </span>
        ))}
      </div>

      <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: runs.map((r) => `${r.span}fr`).join(" ") }}>
        {runs.map((r, i) => (
          <span key={`${r.cityName}-${i}`} className="mono border-t border-rice/25 pt-1.5 text-[0.62rem] text-rice/55">
            {r.cityName ?? "unrouted"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GapCard({ tripId, gap }: { tripId: string; gap: Gap }) {
  const s = SEVERITY[gap.severity];
  return (
    <div className={`tile up flex flex-col ${s.tile} p-5`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`mono text-[0.6rem] uppercase tracking-[0.1em] ${s.label_cls}`}>{s.label}</span>
        {gap.daysLeft != null && (
          <span className="mono pop rounded-full bg-tamago-bright px-2.5 py-1 text-[0.64rem] font-medium text-lacquer">
            {gap.daysLeft === 0 ? "today" : `${gap.daysLeft} days`}
          </span>
        )}
      </div>
      <p className="disp mt-2 text-[1.15rem] font-bold leading-snug">{gap.title}</p>
      <p className="mt-2 flex-1 text-[0.88rem] leading-relaxed text-ink-2">{gap.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {gap.actions.map((a) =>
          a.kind === "add_booking" ? (
            <a
              key={a.label}
              href={`/trips/${tripId}/vault?add=${encodeURIComponent(a.hint ?? "other")}${gap.date ? `&on=${gap.date}` : ""}`}
              className="rounded-full bg-lacquer px-4 py-2 text-[0.82rem] font-medium text-rice"
            >
              {a.label}
            </a>
          ) : (
            <a
              key={a.label}
              href={`/trips/${tripId}?ask=${encodeURIComponent(a.hint ?? "")}`}
              className="rounded-full border border-ink/15 px-4 py-2 text-[0.82rem] font-medium"
            >
              {a.label}
            </a>
          ),
        )}
        <form action={dismissGap} className="ml-auto self-center">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="gapKey" value={gap.key} />
          <button className="mono text-[0.64rem] uppercase tracking-[0.08em] text-ink-3 underline underline-offset-2">Not a problem</button>
        </form>
      </div>
    </div>
  );
}

export function DismissedGaps({ tripId, gaps }: { tripId: string; gaps: Gap[] }) {
  if (!gaps.length) return null;
  return (
    <details className="tile up mt-3 px-5 py-4">
      <summary className="mono cursor-pointer text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">
        {gaps.length} you said {gaps.length === 1 ? "was" : "were"} not a problem
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {gaps.map((g) => (
          <li key={g.key} className="flex flex-wrap items-baseline justify-between gap-2 text-[0.86rem] text-ink-2">
            <span>{g.title}</span>
            <form action={restoreGap}>
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="gapKey" value={g.key} />
              <button className="mono text-[0.62rem] uppercase tracking-[0.08em] text-accent underline underline-offset-2">Bring it back</button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
