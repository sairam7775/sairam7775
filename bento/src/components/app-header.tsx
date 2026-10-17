import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { signOut } from "@/app/(auth)/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { copy } from "@/copy";

/** The signed-in header, one row: the logo goes home to the trips list,
 *  the way back sits beside it where people look for it, and Settings and
 *  sign out are on every page. Page-specific badges go in `children`, on the right.
 *  On a phone it stays one row: with a back link the logo drops its word,
 *  and pages keep wide badges out of `children` below `sm`. */
export function AppHeader({ back, children }: { back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="up flex items-center gap-2 sm:gap-3">
      <Link href="/trips" className="inline-flex shrink-0" aria-label={copy.common.tripsHomeLabel}>
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
        {/* A gear on phones, so the back link keeps room for its label. */}
        <Link href="/settings" className="inline-flex min-h-10 min-w-10 items-center justify-center whitespace-nowrap rounded-full text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink sm:px-3">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="sr-only sm:not-sr-only">{copy.common.settings}</span>
        </Link>
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </header>
  );
}
