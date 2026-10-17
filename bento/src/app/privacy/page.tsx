import Link from "next/link";
import type { Metadata } from "next";
import { BentoLogo } from "@/components/logo";
import { copy } from "@/copy";

const t = copy.privacy;

export const metadata: Metadata = { title: `${t.title} · Bento` };

/** What Bento keeps, who else handles it, and what a traveller can do about
 *  it. Public, so it can be read before signing up. The words are in
 *  copy.privacy; keep them true to the code (analytics.ts, crypto.ts). */
export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex" aria-label={copy.common.homeLabel}><BentoLogo /></Link>
        <Link href="/" className="min-h-10 rounded-full px-3 py-2 text-[0.88rem] text-ink-2 hover:bg-sunk hover:text-ink">{copy.common.homeBack}</Link>
      </header>

      <article className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-[2rem] font-bold leading-tight">{t.title}</h1>
        <p className="mono mt-2 text-[0.75rem] text-ink-3">{t.updated}</p>
        <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-2">{t.intro}</p>

        {Object.entries(t.sections).map(([id, s]) => (
          <section key={id} id={id} className="mt-7 scroll-mt-6">
            <h2 className="text-[1.15rem] font-bold">{s.heading}</h2>
            {s.body.split("\n\n").map((para) => (
              <p key={para.slice(0, 40)} className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{para}</p>
            ))}
          </section>
        ))}

        <p className="mt-8 border-t border-rule pt-5 text-[0.95rem] text-ink-2">
          {t.contactLabel}{" "}
          <a href={`mailto:${t.contact}`} className="font-medium text-accent underline underline-offset-2">{t.contact}</a>
        </p>
      </article>
    </main>
  );
}
