import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo } from "@/components/logo";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-20">
      <BentoLogo size={30} />
      <p className="mono mt-8 text-[0.7rem] uppercase tracking-[0.16em] text-ink-3">
        <span className="mr-3 inline-block h-[2px] w-6 align-middle bg-vermilion" />
        Japan, planned properly
      </p>

      <h1 className="mt-6 text-5xl font-black leading-none tracking-tight sm:text-6xl">
        <span className="block text-[0.42em] font-medium tracking-[0.06em] text-indigo">
          弁当
        </span>
        Bento
      </h1>

      <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
        A trip planner for people who have never been to Japan — one that gives
        the honest version of every place, every train and every gap in the
        plan, the way a local friend would.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {user ? (
          <Link
            href="/trips"
            className="bg-indigo px-5 py-2.5 text-sm font-medium text-surface"
          >
            Your trips
          </Link>
        ) : (
          <>
            <Link
              href="/sign-up"
              className="bg-indigo px-5 py-2.5 text-sm font-medium text-surface"
            >
              Create an account
            </Link>
            <Link
              href="/sign-in"
              className="border border-rule px-5 py-2.5 text-sm font-medium"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      <div className="mt-16 border-t-2 border-ink pt-6">
        <p className="mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3">
          What it does differently
        </p>
        <ul className="mt-5 flex flex-col gap-4 text-[0.95rem] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">Real durations, not listings.</strong>{" "}
            Fushimi Inari is 45 minutes to the gates and three hours to the
            summit. Which one you have time for changes the day.
          </li>
          <li>
            <strong className="text-ink">It admits what it doesn&apos;t know.</strong>{" "}
            Every city says how well it&apos;s covered. A thin guess dressed up
            as a plan is the one thing this won&apos;t do.
          </li>
          <li>
            <strong className="text-ink">It finds the gaps.</strong> The night
            you have no hotel, the leg with no train, the ticket whose booking
            window closes next week.
          </li>
        </ul>
      </div>
    </main>
  );
}
