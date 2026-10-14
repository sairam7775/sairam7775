import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { signOut } from "@/app/(auth)/actions";

/** The signed-in header, one row: the logo goes home to the trips list,
 *  the way back sits beside it where people look for it, and sign out is
 *  on every page. Page-specific badges go in `children`, on the right. */
export function AppHeader({ back, children }: { back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="up flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link href="/trips" className="inline-flex" aria-label="Bento — your trips">
        <BentoLogo />
      </Link>
      {back && (
        <Link
          href={back.href}
          className="ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[0.9rem] font-medium text-ink shadow-tile hover:bg-sunk"
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <form action={signOut}>
          <button className="min-h-10 rounded-full px-3 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink">Sign out</button>
        </form>
      </div>
    </header>
  );
}
