import type { Metadata } from "next";
import { copy } from "@/copy";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

const t = copy.terms;

export const metadata: Metadata = { title: `${t.title} · Bento` };

// Sections that end with a link to another page.
const LINKS: Partial<Record<keyof typeof t.sections, { href: string; label: string }>> = {
  service: { href: "/about", label: copy.privacy.links.operator },
  yours: { href: "/privacy", label: copy.privacy.title },
};

/** The terms a traveller agrees to at sign-up, refunds among them (there is
 *  nothing to pay). The words are in copy.terms. */
export default function Terms() {
  return (
    <LegalPage title={t.title} updated={t.updated} intro={t.intro} current="/terms">
      {Object.entries(t.sections).map(([id, s]) => (
        <LegalSection key={id} id={id} heading={s.heading} body={s.body} link={LINKS[id as keyof typeof t.sections]} />
      ))}
    </LegalPage>
  );
}
