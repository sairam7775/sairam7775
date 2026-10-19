import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { SubmitButton } from "@/components/form-controls";
import { createClient } from "@/lib/supabase/server";
import { copy } from "@/copy";
import { SETTINGS } from "./paths";

/** The signed-in traveller, or off to sign in and then back to `path`. */
export async function signedIn(path: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${path}`);
  return { supabase, user };
}

/** One Settings page: the header, the way back (to the trips list from the
 *  main list, to the list from each group's page) and the title. */
export function SettingsPage({ title, userId, back, wide = true, children }: {
  title: string;
  userId: string;
  back?: { href: string; label: string };
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"} px-5 py-10 sm:py-14`}>
      <AppHeader back={back ?? { href: SETTINGS.home, label: copy.common.settings }} />
      <AnalyticsUser id={userId} />
      <h1 className="up mt-8 text-3xl font-bold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}

/** A card of rows on a list page; each row opens a page or does one thing. */
export function RowList({ className = "mt-4", children }: { className?: string; children: ReactNode }) {
  return <ul className={`tile up divide-y divide-rule overflow-hidden ${className}`}>{children}</ul>;
}

const row = "flex min-h-16 w-full items-center gap-3 px-6 py-3.5 text-left hover:bg-sunk";

function RowText({ title, summary, danger }: { title: string; summary: string; danger?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={`text-[1rem] font-semibold ${danger ? "text-ume" : "text-ink"}`}>{title}</span>
      <span className="break-words text-[0.88rem] text-ink-2">{summary}</span>
    </span>
  );
}

/** A row that opens another page: what it is, what's set now, and a chevron. */
export function LinkRow({ href, title, summary, danger }: { href: string; title: string; summary: string; danger?: boolean }) {
  return (
    <li>
      <Link href={href} className={row}>
        <RowText title={title} summary={summary} danger={danger} />
        <span aria-hidden className="shrink-0 text-[1.3rem] leading-none text-ink-3">›</span>
      </Link>
    </li>
  );
}

/** A row that does one thing straight away, through a server action; while
 *  it runs, its title says so (`pending`). */
export function ActionRow({ action, title, pending, summary }: { action: () => Promise<void>; title: string; pending: string; summary: string }) {
  return (
    <li>
      <form action={action}>
        <SubmitButton className={`${row} cursor-pointer`} pending={<RowText title={pending} summary={summary} />}>
          <RowText title={title} summary={summary} />
          <span aria-hidden className="shrink-0 text-[1.1rem] leading-none text-ink-3">↻</span>
        </SubmitButton>
      </form>
    </li>
  );
}
