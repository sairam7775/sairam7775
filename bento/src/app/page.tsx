import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo, BentoMark } from "@/components/logo";
import { copy } from "@/copy";
import { AnalyticsSignedOut } from "@/components/analytics/analytics";

const t = copy.home;

const primary = "inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-[0.95rem] font-medium text-white hover:bg-accent-deep";
const secondary = "inline-flex min-h-11 items-center rounded-full border border-rule bg-surface px-6 text-[0.95rem] font-medium text-ink hover:bg-sunk";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cta = user ? (
    <Link href="/trips" className={primary}>{t.yourTripsCta}</Link>
  ) : (
    <>
      <Link href="/sign-up" className={primary}>{t.startPlanning}</Link>
      <Link href="/sign-in" className={secondary}>{copy.common.signIn}</Link>
    </>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      {!user && <AnalyticsSignedOut />}
      <header className="up flex items-center justify-between gap-3">
        <Link href="/" aria-label={copy.common.homeLabel} className="inline-flex"><BentoLogo /></Link>
        <nav className="flex items-center gap-1">
          <a href="#how" className="hidden min-h-10 items-center rounded-full px-3 text-[0.9rem] text-ink-2 hover:bg-sunk hover:text-ink sm:inline-flex">{t.howItWorksLink}</a>
          {user ? (
            <Link href="/trips" className="inline-flex min-h-10 items-center rounded-full px-3 text-[0.9rem] font-medium text-ink hover:bg-sunk">{copy.common.yourTrips}</Link>
          ) : (
            <Link href="/sign-in" className="inline-flex min-h-10 items-center rounded-full px-3 text-[0.9rem] font-medium text-ink hover:bg-sunk">{copy.common.signIn}</Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mt-12 grid items-center gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="up" style={{ animationDelay: ".05s" }}>
          <p className="flex items-center gap-3 text-[0.9rem] font-medium text-ink-2">
            <span aria-hidden className="h-[2px] w-7 bg-accent" />
            {t.hero.kicker}
            <span lang="ja" className="text-accent">{t.hero.kickerJa}</span>
          </p>
          <h1 className="mt-5 text-[2.6rem] font-black leading-[1.05] sm:text-[3.6rem]">
            {t.hero.title}
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.08rem] leading-relaxed text-ink-2">
            {t.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">{cta}</div>
          <p className="mt-4 text-[0.85rem] text-ink-3">{t.hero.note}</p>
        </div>
        <DayPreview />
      </section>

      {/* How it works */}
      <section id="how" className="mt-24 scroll-mt-8">
        <SectionHead eyebrow={t.how.eyebrow} title={t.how.title} />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {Object.values(t.how.steps).map((s, i) => (
            <Step key={s.title} n={i + 1} title={s.title}>{s.body}</Step>
          ))}
        </ol>
      </section>

      {/* Differently */}
      <section className="mt-24">
        <SectionHead eyebrow={t.different.eyebrow} title={t.different.title} />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card tone="bg-accent" title={t.different.durations.title}>{t.different.durations.body}</Card>
          <Card tone="bg-tamago-bright" title={t.different.honest.title}>{t.different.honest.body}</Card>
          <Card tone="bg-ume" title={t.different.gaps.title}>{t.different.gaps.body}</Card>
        </div>
      </section>

      {/* Coverage */}
      <section className="mt-24">
        <div className="tile grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <div>
            <p className="text-[0.85rem] font-bold text-accent-deep">{t.coverage.eyebrow}</p>
            <h2 className="mt-2 text-[1.7rem] font-bold leading-tight">{t.coverage.title}</h2>
            <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-2">{t.coverage.body}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {Object.values(t.coverage.cities).map(({ name: en, ja }) => (
              <li key={en} className="flex items-baseline gap-2 rounded-full border border-rule bg-paper px-4 py-2">
                <span className="font-medium">{en}</span>
                <span lang="ja" className="text-[0.85rem] text-ink-3">{ja}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing */}
      <section className="box mt-24 p-3">
        <div className="flex flex-col items-start gap-5 rounded-tile px-6 py-10 text-rice sm:px-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[1.9rem] font-bold leading-tight">{t.closing.title}</h2>
            <p className="mt-2 max-w-[36rem] text-[0.98rem] text-rice/75">{t.closing.body}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Link href="/trips" className={primary}>{t.yourTripsCta}</Link>
            ) : (
              <Link href="/sign-up" className={primary}>{t.startPlanning}</Link>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-rule py-6 text-[0.85rem] text-ink-3">
        <span className="inline-flex items-center gap-2"><BentoMark size={18} /> {t.footer}</span>
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">{t.privacy}</Link>
        <span lang="ja">{t.footerJa}</span>
      </footer>
    </main>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[0.85rem] font-bold text-accent-deep">{eyebrow}</p>
      <h2 className="mt-1 text-[2rem] font-bold leading-tight">{title}</h2>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="tile lift p-6">
      <span className="disp inline-flex h-9 w-9 items-center justify-center rounded-full bg-lacquer text-[1rem] font-bold text-rice">{n}</span>
      <h3 className="mt-4 text-[1.15rem] font-bold">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{children}</p>
    </li>
  );
}

function Card({ tone, title, children }: { tone: string; title: string; children: ReactNode }) {
  return (
    <div className="tile lift p-6">
      <span aria-hidden className={`block h-1.5 w-10 rounded-full ${tone}`} />
      <h3 className="mt-4 text-[1.15rem] font-bold">{title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

/** A sample day, drawn the way the app draws one: a lacquer box with a
 *  compartment per stop, sized to its time, and Bento Man underneath. It's
 *  an illustration, so it's hidden from screen readers in favour of the
 *  sentence it illustrates. */
function DayPreview() {
  const p = t.preview;
  // Height and colour per stop.
  const looks: Record<keyof typeof p.stops, [number, string]> = {
    inari: [92, "bg-accent-soft"], tofukuji: [64, "bg-edamame-soft"], lunch: [40, "bg-tamago-soft"], sanjusangendo: [72, "bg-lavender-soft"],
  };
  return (
    <figure className="up relative" style={{ animationDelay: ".15s" }}>
      <figcaption className="sr-only">{p.caption}</figcaption>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="disp text-[1.2rem] font-bold">{p.date}</span>
          <span className="mono text-[0.78rem] text-ink-3">{p.summary}</span>
        </div>
        <div className="box p-2.5">
          <div className="flex flex-col gap-2">
            {(Object.keys(p.stops) as (keyof typeof p.stops)[]).map((key, i) => {
              const { time, name, why } = p.stops[key];
              const [h, tint] = looks[key];
              return (
              <div key={name} className={`up rounded-tile px-4 py-3 ${tint}`} style={{ minHeight: h, animationDelay: `${0.25 + i * 0.08}s` }}>
                <div className="flex items-baseline gap-3">
                  <span className="mono text-[0.78rem] text-ink-2">{time}</span>
                  <span className="disp text-[0.98rem] font-bold text-ink">{name}</span>
                </div>
                {why && <p className="mt-1 text-[0.85rem] leading-snug text-ink-2">{why}</p>}
              </div>
              );
            })}
          </div>
        </div>
        <div className="tile up ml-6 flex gap-3 p-4 sm:ml-10" style={{ animationDelay: ".6s" }}>
          <span className="mt-0.5 shrink-0"><BentoMark size={22} /></span>
          <p className="text-[0.9rem] leading-relaxed text-ink">
            {p.bentoMan}
          </p>
        </div>
      </div>
    </figure>
  );
}
