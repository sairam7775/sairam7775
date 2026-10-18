import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { copy } from "@/copy";

/** A whole-page message — not found, or something broke — that always
 *  leaves a way back into the app. */
export function StatusPage({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-8">
      <Link href="/" className="inline-flex self-start" aria-label={copy.common.homeLabel}>
        <BentoLogo />
      </Link>
      <section className="tile up mt-10 p-6 sm:p-8">
        <p className="mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-3">{kicker}</p>
        <h1 className="mt-2 text-[1.8rem] font-bold leading-tight">{title}</h1>
        <div className="mt-3 text-[0.98rem] leading-relaxed text-ink-2">{children}</div>
      </section>
    </main>
  );
}

export const primaryButton =
  "inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[0.95rem] font-medium text-on-accent hover:bg-accent-deep";
export const secondaryButton =
  "inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] text-ink hover:bg-sunk";
