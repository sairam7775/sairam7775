import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { signOut } from "@/app/(auth)/actions";

/** The signed-in header, one row: the logo goes home to the trips list,
 *  the way back sits beside it where people look for it, and sign out is
 *  on every page. Page-specific badges go in `children`, on the right.
 *  On a phone it stays one row: with a back link the logo drops its word,
 *  and pages keep wide badges out of `children` below `sm`. */
export function AppHeader({ back, children }: { back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="up flex items-center gap-2 sm:gap-3">
      <Link href="/trips" className="inline-flex shrink-0" aria-label="Bento — your trips">
        <BentoLogo wordClassName={back ? "hidden sm:inline" : ""} />
      </Link>
      {back && (
        <Link
          href={back.href}
          className="inline-flex min-h-10 min-w-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[0.9rem] font-medium text-ink shadow-tile hover:bg-sunk sm:ml-1 sm:px-4"
        >
          <span aria-hidden>←</span> <span className="truncate">{back.label}</span>
        </Link>
      )}
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
        {children}
        <form action={signOut}>
          <button className="min-h-10 whitespace-nowrap rounded-full px-2.5 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink sm:px-3">Sign out</button>
        </form>
      </div>
    </header>
  );
}
