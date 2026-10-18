import type { Metadata } from "next";
import { copy } from "@/copy";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

const t = copy.about;

export const metadata: Metadata = { title: `${t.title} · Bento` };

/** Business details: who runs Bento and how to reach them (Japan's privacy
 *  law asks for the operator's name; the full name and address are given on
 *  request), that Bento is free and sells nothing, and the credits for the
 *  fonts and images it uses. The operator lives at the top of copy/en.ts. */
export default function About() {
  return (
    <LegalPage title={t.title} updated={t.updated} intro={t.intro} current="/about">
      <LegalSection id="details" heading={t.details.heading}>
        <dl className="mt-3 divide-y divide-rule rounded-xl bg-sunk px-4">
          {Object.entries(t.details.rows).map(([key, row]) => (
            <div key={key} className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="text-[0.88rem] text-ink-3">{row.label}</dt>
              <dd className="text-[0.95rem] text-ink">
                {key === "contact" ? (
                  <a href={`mailto:${row.value}`} className="font-medium text-accent-ink underline underline-offset-2">{row.value}</a>
                ) : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection
        id="commerce"
        heading={<><span lang="ja">{t.commerce.heading}</span><span className="mt-0.5 block text-[0.9rem] font-normal text-ink-2">{t.commerce.headingMeaning}</span></>}
        body={t.commerce.body}
      />

      <LegalSection id="credits" heading={t.credits.heading} body={t.credits.body}>
        <p className="mt-2 text-[0.95rem]">
          <a href="https://openfontlicense.org/open-font-license-official-text/" className="font-medium text-accent-ink underline underline-offset-2">{t.credits.licence}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
