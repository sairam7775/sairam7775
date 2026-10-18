import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { copy } from "@/copy";

const t = copy.legal;

/** The legal pages, in the order they are linked everywhere: here, the home
 *  footer and Settings. */
export const LEGAL_LINKS = [
  { href: "/privacy", label: t.privacy },
  { href: "/terms", label: t.terms },
  { href: "/cookies", label: t.cookies },
  { href: "/about", label: t.about },
] as const;

export type LegalHref = (typeof LEGAL_LINKS)[number]["href"];

/** One frame for privacy, terms, cookies and who runs Bento. Public, so each
 *  can be read before signing up; each ends with the contact address and
 *  the links to the others. */
export function LegalPage({ title, updated, intro, current, children }: {
  title: string;
  updated: string;
  intro: string;
  current: LegalHref;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex" aria-label={copy.common.homeLabel}><BentoLogo /></Link>
        <Link href="/" className="min-h-10 rounded-full px-3 py-2 text-[0.88rem] text-ink-2 hover:bg-sunk hover:text-ink">{copy.common.homeBack}</Link>
      </header>

      <article className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-[2rem] font-bold leading-tight">{title}</h1>
        <p className="mono mt-2 text-[0.75rem] text-ink-3">{updated}</p>
        <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-2">{intro}</p>

        {children}

        <p className="mt-8 border-t border-rule pt-5 text-[0.95rem] text-ink-2">
          {t.contactLabel}{" "}
          <a href={`mailto:${t.contact}`} className="font-medium text-accent-ink underline underline-offset-2">{t.contact}</a>
        </p>
      </article>

      <LegalNav current={current} className="mt-6 px-1" />
    </main>
  );
}

/** A heading and its paragraphs (a blank line in the copy starts a new one),
 *  with an optional link under them. The heading's id is `<id>-heading`,
 *  for a control group inside to be labelled by. */
export function LegalSection({ id, heading, body, link, children }: {
  id: string;
  heading: ReactNode;
  body?: string;
  link?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <section id={id} className="mt-7 scroll-mt-6">
      <h2 id={`${id}-heading`} className="text-[1.15rem] font-bold">{heading}</h2>
      {body?.split("\n\n").map((para) => (
        <p key={para.slice(0, 40)} className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{para}</p>
      ))}
      {children}
      {link && (
        <p className="mt-2 text-[0.95rem]">
          <Link href={link.href} className="font-medium text-accent-ink underline underline-offset-2">{link.label}</Link>
        </p>
      )}
    </section>
  );
}

/** The links between the legal pages. The page you're on is marked, not linked. */
export function LegalNav({ current, className = "" }: { current?: LegalHref; className?: string }) {
  return (
    <nav aria-label={t.navLabel} className={className}>
      <ul className="flex flex-wrap gap-x-1 gap-y-1 text-[0.88rem]">
        {LEGAL_LINKS.map((l) => (
          <li key={l.href}>
            {l.href === current ? (
              <span aria-current="page" className="inline-flex min-h-10 items-center px-2.5 font-medium text-ink">{l.label}</span>
            ) : (
              <Link href={l.href} className="inline-flex min-h-10 items-center rounded-full px-2.5 text-ink-2 underline underline-offset-2 hover:bg-sunk hover:text-ink">{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
