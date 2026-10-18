import Link from "next/link";
import { BentoLogo } from "@/components/logo";
import { copy } from "@/copy";

/** A shared link that opens nothing: switched off, replaced, or mistyped.
 *  The same words for each, so a link says nothing about a trip that was. */
export default function SharedLinkGone() {
  const t = copy.share.gone;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:px-8">
      <Link href="/" className="inline-flex self-start" aria-label={copy.common.homeLabel}>
        <BentoLogo />
      </Link>
      <section className="tile up mt-10 p-6 sm:p-8">
        <h1 className="text-[1.8rem] font-bold leading-tight">{t.title}</h1>
        <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-2">{t.body}</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] text-ink hover:bg-sunk">
          {copy.common.homeBack}
        </Link>
      </section>
    </main>
  );
}
