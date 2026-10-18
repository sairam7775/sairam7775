import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { ErrorNote, Field, Notice } from "@/app/(auth)/ui";
import { deleteAccount } from "@/app/(auth)/actions";
import { googleOnly } from "@/lib/account/identity";
import { ConfirmButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { replayTours } from "@/components/tour/actions";
import { THEMES, THEME_COOKIE, parseTheme } from "@/lib/theme";
import { setAnalytics, setBackground, setTheme } from "./actions";
import { ANALYTICS_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { ChoiceButton, SubmitButton } from "@/components/form-controls";
import { BACKGROUNDS, BACKGROUND_COOKIE, parseBackground } from "@/components/seasonal/season";
import { LegalNav } from "@/components/legal/legal-page";
import { copy } from "@/copy";

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  const sp = await searchParams;
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
  const analytics = parseConsent(jar.get(ANALYTICS_COOKIE)?.value) === "yes";
  const viaGoogle = googleOnly(user);
  const t = copy.settings;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/trips", label: copy.common.yourTrips }} />
      <AnalyticsUser id={user.id} />
      <h1 className="up mt-8 text-3xl font-bold tracking-tight">{t.title}</h1>

      <div className="mt-6">{sp.updated === "password" && <Notice>{t.passwordChanged}</Notice>}</div>

      <section className="tile up mt-2 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.account}</h2>
        <p className="mono mt-2 break-all text-[0.9rem] text-ink-2">{user.email}</p>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.password.heading}</h2>
        {viaGoogle ? (
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.password.google}</p>
        ) : (
          <>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.password.body}</p>
            <Link href="/settings/password" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
              {t.password.change}
            </Link>
          </>
        )}
      </section>

      <section className="tile up mt-4 p-6">
        <h2 id="theme-heading" className="text-[1.1rem] font-bold">{t.theme.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.theme.body}</p>
        <form action={setTheme} className="mt-4">
          <div role="group" aria-labelledby="theme-heading" className="inline-flex rounded-full border border-rule p-1">
            {THEMES.map((value) => (
              <ChoiceButton
                key={value}
                name="theme"
                value={value}
                pressed={theme === value}
                className={`min-h-10 rounded-full px-4 text-[0.92rem] ${theme === value ? "bg-lacquer text-rice" : "text-ink-2 hover:bg-sunk hover:text-ink"}`}
              >
                {t.theme[value]}
              </ChoiceButton>
            ))}
          </div>
        </form>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 id="background-heading" className="text-[1.1rem] font-bold">{t.background.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.background.body}</p>
        <form action={setBackground} className="mt-4">
          <div role="group" aria-labelledby="background-heading" className="flex flex-wrap gap-2">
            {BACKGROUNDS.map((value) => (
              <ChoiceButton
                key={value}
                name="background"
                value={value}
                pressed={background === value}
                className={`min-h-10 rounded-full border px-4 text-[0.92rem] ${background === value ? "border-lacquer bg-lacquer text-rice" : "border-rule text-ink-2 hover:bg-sunk hover:text-ink"}`}
              >
                {t.background[value]}
              </ChoiceButton>
            ))}
          </div>
        </form>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.tour.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.tour.body}</p>
        <form action={replayTours}>
          <SubmitButton pending={t.tour.pending} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
            {t.tour.replay}
          </SubmitButton>
        </form>
      </section>

      {/* Only where analytics can run: no key, nothing to ask about. */}
      {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
      <section className="tile up mt-4 p-6">
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

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.legal.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.legal.body}</p>
        <LegalNav className="-mx-2.5 mt-2" />
      </section>

      <section id="delete-account" className="tile up mt-4 scroll-mt-6 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.deleteAccount.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.deleteAccount.body}</p>
        <div className="mt-4">
          <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
          <form action={deleteAccount} className="flex max-w-sm flex-col gap-4">
            {viaGoogle ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delete-email" className={fieldLabel}>{t.deleteAccount.email}</label>
                <input id="delete-email" name="email" type="email" required autoComplete="off" placeholder={user.email ?? ""} className={fieldInput} />
              </div>
            ) : (
              <Field id="delete-password" name="password" type="password" label={t.deleteAccount.password} autoComplete="current-password" />
            )}
            <ConfirmButton message={t.deleteAccount.confirm} pending={t.deleteAccount.pending} className="self-start min-h-11 rounded-full border border-ume px-5 text-[0.95rem] font-medium text-ume hover:bg-ume-soft">
              {t.deleteAccount.submit}
            </ConfirmButton>
          </form>
        </div>
      </section>
    </main>
  );
}
