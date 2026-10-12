import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo, BentoMark } from "@/components/logo";

const primary = "inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-[0.95rem] font-medium text-white hover:bg-accent-deep";
const secondary = "inline-flex min-h-11 items-center rounded-full border border-rule bg-surface px-6 text-[0.95rem] font-medium text-ink hover:bg-sunk";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cta = user ? (
    <Link href="/trips" className={primary}>Your trips →</Link>
  ) : (
    <>
      <Link href="/sign-up" className={primary}>Start planning</Link>
      <Link href="/sign-in" className={secondary}>Sign in</Link>
    </>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      <header className="up flex items-center justify-between gap-3">
        <Link href="/" aria-label="Bento home" className="inline-flex"><BentoLogo /></Link>
        <nav className="flex items-center gap-1">
          <a href="#how" className="hidden min-h-10 items-center rounded-full px-3 text-[0.9rem] text-ink-2 hover:bg-sunk hover:text-ink sm:inline-flex">How it works</a>
          {user ? (
            <Link href="/trips" className="inline-flex min-h-10 items-center rounded-full px-3 text-[0.9rem] font-medium text-ink hover:bg-sunk">Your trips</Link>
          ) : (
            <Link href="/sign-in" className="inline-flex min-h-10 items-center rounded-full px-3 text-[0.9rem] font-medium text-ink hover:bg-sunk">Sign in</Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mt-12 grid items-center gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="up" style={{ animationDelay: ".05s" }}>
          <p className="flex items-center gap-3 text-[0.9rem] font-medium text-ink-2">
            <span aria-hidden className="h-[2px] w-7 bg-accent" />
            For your first trip to Japan
            <span lang="ja" className="text-accent">弁当</span>
          </p>
          <h1 className="mt-5 text-[2.6rem] font-black leading-[1.05] sm:text-[3.6rem]">
            Plan Japan like you’ve been before.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.08rem] leading-relaxed text-ink-2">
            Bento is a trip planner that tells you the honest version — how long each place really takes,
            which trains to catch, and what’s still missing from your plan — the way a friend who lives there would.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">{cta}</div>
          <p className="mt-4 text-[0.85rem] text-ink-3">Bento suggests; you decide. Nothing changes in your plan until you say yes.</p>
        </div>
        <DayPreview />
      </section>

      {/* How it works */}
      <section id="how" className="mt-24 scroll-mt-8">
        <SectionHead eyebrow="How it works" title="Three steps, one box" />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          <Step n={1} title="Tell Bento Man the trip">
            Your dates, who’s going, what you love and what you’d never do. A few questions in a chat, not a long form.
          </Step>
          <Step n={2} title="Get a route that adds up">
            Cities and nights in order, with the train time between them. If it’s too much, it says so — with the arithmetic.
          </Step>
          <Step n={3} title="Open each day like a box">
            Every stop sized to the time it takes, the train written between them. Pin, reorder, or ask for a re-plan.
          </Step>
        </ol>
      </section>

      {/* Differently */}
      <section className="mt-24">
        <SectionHead eyebrow="What it does differently" title="Honest, not exhaustive" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card tone="bg-accent" title="Real durations, not listings">
            Fushimi Inari is 45 minutes to the gates and three hours to the summit. Which one you have time for changes the day.
          </Card>
          <Card tone="bg-tamago-bright" title="It admits what it doesn’t know">
            Every city says how well it’s covered. A thin guess dressed up as a plan is the one thing this won’t do.
          </Card>
          <Card tone="bg-ume" title="It finds the gaps">
            The night you have no hotel, the leg with no train, the ticket whose booking window closes next week.
          </Card>
        </div>
      </section>

      {/* Coverage */}
      <section className="mt-24">
        <div className="tile grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <div>
            <p className="text-[0.85rem] font-bold text-accent-deep">Where it knows best today</p>
            <h2 className="mt-2 text-[1.7rem] font-bold leading-tight">The Kansai–Sanyo corridor</h2>
            <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-2">
              The trains between these cities, with real times and fares, and place-by-place detail for the cities most first trips are built on.
              The rest of Japan is on the map too — and each city tells you how much Bento really knows about it.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {[["Kyoto", "京都"], ["Osaka", "大阪"], ["Nara", "奈良"], ["Himeji", "姫路"], ["Hiroshima", "広島"], ["Miyajima", "宮島"]].map(([en, ja]) => (
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
            <h2 className="text-[1.9rem] font-bold leading-tight">Your first trip, without the guesswork.</h2>
            <p className="mt-2 max-w-[36rem] text-[0.98rem] text-rice/75">Start with your dates. Bento Man takes it from there.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Link href="/trips" className={primary}>Your trips →</Link>
            ) : (
              <Link href="/sign-up" className={primary}>Start planning</Link>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-rule py-6 text-[0.85rem] text-ink-3">
        <span className="inline-flex items-center gap-2"><BentoMark size={18} /> Bento — Japan, planned properly</span>
        <span lang="ja">いってらっしゃい</span>
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
  const stops: [string, string, string, number, string][] = [
    ["07:30", "Fushimi Inari Taisha", "Before the tour groups — the lower gates are quiet until about 8.", 92, "bg-accent-soft"],
    ["10:20", "Tofuku-ji", "Two stops south. The bridge view is the point.", 64, "bg-edamame-soft"],
    ["12:30", "Lunch near Kyoto Station", "", 40, "bg-tamago-soft"],
    ["14:00", "Sanjusangen-do", "1,001 statues in one hall. Shoes off; allow an hour.", 72, "bg-lavender-soft"],
  ];
  return (
    <figure className="up relative" style={{ animationDelay: ".15s" }}>
      <figcaption className="sr-only">An example day in Kyoto, planned by Bento: four stops from 7:30, with the reason for each.</figcaption>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <span className="disp text-[1.2rem] font-bold">Sunday 22 November</span>
          <span className="mono text-[0.78rem] text-ink-3">Kyoto · 6h 40m</span>
        </div>
        <div className="box p-2.5">
          <div className="flex flex-col gap-2">
            {stops.map(([time, name, why, h, tint], i) => (
              <div key={name} className={`up rounded-tile px-4 py-3 ${tint}`} style={{ minHeight: h, animationDelay: `${0.25 + i * 0.08}s` }}>
                <div className="flex items-baseline gap-3">
                  <span className="mono text-[0.78rem] text-ink-2">{time}</span>
                  <span className="disp text-[0.98rem] font-bold text-ink">{name}</span>
                </div>
                {why && <p className="mt-1 text-[0.85rem] leading-snug text-ink-2">{why}</p>}
              </div>
            ))}
          </div>
        </div>
        <div className="tile up ml-6 flex gap-3 p-4 sm:ml-10" style={{ animationDelay: ".6s" }}>
          <span className="mt-0.5 shrink-0"><BentoMark size={22} /></span>
          <p className="text-[0.9rem] leading-relaxed text-ink">
            Arashiyama is the other side of the city — fifty minutes each way. I’ve left it for Tuesday, when you’re already west.
          </p>
        </div>
      </div>
    </figure>
  );
}
