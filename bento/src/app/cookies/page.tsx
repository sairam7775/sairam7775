import type { Metadata } from "next";
import { cookies } from "next/headers";
import { copy } from "@/copy";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { ChoiceButton } from "@/components/form-controls";
import { setAnalytics } from "@/app/settings/actions";
import { ANALYTICS_COOKIE, parseConsent } from "@/lib/analytics/consent";

const t = copy.cookies;

export const metadata: Metadata = { title: `${t.title} · Bento` };

type Row = { name: string; purpose: string; lasts: string };

/** Every cookie Bento sets, what it's for and how long it lasts, and the
 *  analytics answer, changeable here whether or not you're signed in (the
 *  banner's only other way back is Settings, which needs an account). Keep
 *  the rows true to the code: a new cookie gets a row in copy.cookies. */
export default async function Cookies() {
  const consent = parseConsent((await cookies()).get(ANALYTICS_COOKIE)?.value);
  const configured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  return (
    <LegalPage title={t.title} updated={t.updated} intro={t.intro} current="/cookies">
      <LegalSection id="needed" heading={t.needed.heading} body={t.needed.body}>
        <CookieList rows={Object.values(t.needed.rows)} />
      </LegalSection>

      <LegalSection id="analytics" heading={t.analytics.heading} body={t.analytics.body}>
        <CookieList rows={Object.values(t.analytics.rows)} />
      </LegalSection>

      <LegalSection id="choice" heading={t.choice.heading} body={configured ? t.choice.body : t.choice.off}>
        {configured && (
          <>
            <p className="mt-3 text-[0.95rem] font-medium text-ink">{consent === null ? t.choice.none : t.choice[consent]}</p>
            <form action={setAnalytics} className="mt-3">
              <div role="group" aria-labelledby="choice-heading" className="flex flex-wrap gap-2">
                {([["yes", copy.consent.accept], ["no", copy.consent.decline]] as const).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    name="analytics"
                    value={value}
                    pressed={consent === value}
                    className={`min-h-10 rounded-full border px-5 text-[0.92rem] font-medium ${consent === value ? "border-lacquer bg-lacquer text-rice" : "border-rule text-ink hover:bg-sunk"}`}
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </form>
          </>
        )}
      </LegalSection>

      <LegalSection id="browser" heading={t.browser.heading} body={t.browser.body} />
    </LegalPage>
  );
}

function CookieList({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.name} className="rounded-xl bg-sunk px-4 py-3">
          <p className="mono break-all text-[0.85rem] font-medium text-ink">{r.name}</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.9rem] leading-snug">
            <dt className="text-ink-3">{t.purpose}</dt>
            <dd className="text-ink-2">{r.purpose}</dd>
            <dt className="text-ink-3">{t.lasts}</dt>
            <dd className="text-ink-2">{r.lasts}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
