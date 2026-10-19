import Link from "next/link";
import { cookies } from "next/headers";
import { ChoiceButton } from "@/components/form-controls";
import { LegalNav } from "@/components/legal/legal-page";
import { ANALYTICS_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { copy } from "@/copy";
import { setAnalytics } from "../actions";
import { SETTINGS } from "../paths";
import { LinkRow, RowList, SettingsPage, signedIn } from "../ui";

/** Settings → Privacy & data: usage analytics (where it can run), what
 *  Bento keeps and its terms, and the way to deleting the account, which
 *  has a page of its own so the form isn't left open here. */
export default async function PrivacyAndData() {
  const { user } = await signedIn(SETTINGS.privacy);
  const analytics = parseConsent((await cookies()).get(ANALYTICS_COOKIE)?.value) === "yes";
  const t = copy.settings;

  return (
    <SettingsPage title={t.privacy.title} userId={user.id}>
      <div className="tile up mt-6 divide-y divide-rule">
        {/* Only where analytics can run: no key, nothing to ask about. */}
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <section className="p-6">
            <h2 id="analytics-heading" className="text-[1.1rem] font-bold">{t.analytics.heading}</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
              {t.analytics.body}{" "}
              <Link href="/privacy" className="text-accent-ink underline underline-offset-2">{t.analytics.more}</Link>
            </p>
            <form action={setAnalytics} className="mt-4">
              <div role="group" aria-labelledby="analytics-heading" className="inline-flex rounded-full border border-rule p-1">
                {([["yes", t.analytics.on], ["no", t.analytics.off]] as const).map(([value, label]) => {
                  const pressed = (value === "yes") === analytics;
                  return (
                    <ChoiceButton
                      key={value}
                      name="analytics"
                      value={value}
                      pressed={pressed}
                      className={`min-h-10 rounded-full px-4 text-[0.92rem] ${pressed ? "bg-lacquer text-rice" : "text-ink-2 hover:bg-sunk hover:text-ink"}`}
                    >
                      {label}
                    </ChoiceButton>
                  );
                })}
              </div>
            </form>
          </section>
        )}

        <section className="p-6">
          <h2 className="text-[1.1rem] font-bold">{t.legal.heading}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.legal.body}</p>
          <LegalNav className="-mx-2.5 mt-2" />
        </section>
      </div>

      <RowList>
        <LinkRow href={SETTINGS.deleteAccount} title={t.deleteAccount.heading} summary={t.deleteAccount.summary} danger />
      </RowList>
    </SettingsPage>
  );
}
