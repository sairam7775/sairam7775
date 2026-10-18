import type { Metadata } from "next";
import { copy } from "@/copy";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { configuredProvider } from "@/lib/bento-man/provider";
import { googleSignInEnabled } from "@/lib/auth-config";
import { analyticsDeletionConfigured } from "@/lib/account/delete";

const t = copy.privacy;

export const metadata: Metadata = { title: `${t.title} · Bento` };

/** What Bento keeps, who else handles it, and what a traveller can do about
 *  it. Public, so it can be read before signing up. The words are in
 *  copy.privacy; keep them true to the code (analytics.ts, crypto.ts). It
 *  renders per request, so the named Bento Man provider follows the env. */
export const dynamic = "force-dynamic";

// Sections that end with a link to another page.
const LINKS: Partial<Record<keyof typeof t.sections, { href: string; label: string }>> = {
  operator: { href: "/about", label: t.links.operator },
  cookies: { href: "/cookies", label: t.links.cookies },
};

export default function Privacy() {
  // Name the provider this deployment really sends Bento Man's chat to.
  const chat = configuredProvider();
  const google = googleSignInEnabled();
  const analyticsDeletion = analyticsDeletionConfigured();
  return (
    <LegalPage title={t.title} updated={t.updated} intro={t.intro} current="/privacy">
      {Object.entries(t.sections).map(([id, s]) => (
        <LegalSection
          key={id}
          id={id}
          heading={s.heading}
          body={typeof s.body === "function" ? s.body(chat, google, analyticsDeletion) : s.body}
          link={LINKS[id as keyof typeof t.sections]}
        />
      ))}
    </LegalPage>
  );
}
