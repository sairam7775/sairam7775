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
import { setAnalytics, setBackground, setDisplayName, setTheme } from "./actions";
import { addAdmin, removeAdmin } from "./admin-actions";
import { parseAdminError } from "./admin-errors";
import { displayName, NAME_MAX } from "@/lib/account/name";
import { isAdmin } from "@/lib/admin";
import { adminOverview, type AdminOverview } from "@/lib/admin-overview";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const name = displayName(user) ?? "";
  // Read with the service role, so only once the viewer is known to be an admin.
  const admin = (await isAdmin(supabase, user.id)) ? await adminOverview(createAdminClient()) : null;
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

      <section id="name" className="tile up mt-4 scroll-mt-6 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.name.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.name.body}</p>
        {sp.nameError === "1" && <div className="mt-3"><ErrorNote message={t.name.failed} /></div>}
        <form action={setDisplayName} className="mt-4 flex max-w-md flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="display-name" className={fieldLabel}>{t.name.label}</label>
            {/* Keyed by the saved name, so the field shows it again after saving. */}
            <input key={name} id="display-name" name="name" type="text" defaultValue={name} maxLength={NAME_MAX} autoComplete="given-name" className={fieldInput} />
          </div>
          <SubmitButton pending={copy.common.saving} className="min-h-11 rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
            {t.name.save}
          </SubmitButton>
        </form>
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

      {admin && <AdminSection overview={admin} you={user.id} added={sp.admin} error={parseAdminError(sp.adminError)} />}

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

/** Admins only: the curation tools, this month's AI spend and model, and
 *  who else is an admin. The actions check admin rights again themselves. */
function AdminSection({ overview: o, you, added, error }: { overview: AdminOverview; you: string; added: unknown; error: ReturnType<typeof parseAdminError> }) {
  const t = copy.settings.admin;
  const link = "inline-flex min-h-10 items-center rounded-full border border-rule px-4 text-[0.9rem] hover:bg-sunk";
  const date = (iso: string) => new Date(iso).toLocaleDateString(copy.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <section id="admin" aria-labelledby="admin-heading" className="tile up mt-4 scroll-mt-6 p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="admin-heading" className="text-[1.1rem] font-bold">{t.heading}</h2>
        <p className="text-[0.85rem] text-ink-3">{t.body}</p>
      </div>

      <h3 className="mt-5 text-[0.95rem] font-bold">{t.tools.heading}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        <li><Link href="/admin" className={link}>{t.tools.curation}</Link></li>
        <li><Link href="/admin/review" className={link}>{o.toCheck == null ? t.tools.reviewPlain : t.tools.review(o.toCheck)}</Link></li>
        {o.toCheck !== 0 && <li><Link href="/admin/review/bulk" className={link}>{t.tools.bulk}</Link></li>}
        <li><Link href="/admin/trip-reviews" className={link}>{o.tripReviews == null ? t.tools.tripReviewsPlain : t.tools.tripReviews(o.tripReviews)}</Link></li>
      </ul>

      <h3 className="mt-6 text-[0.95rem] font-bold">{t.spend.heading}</h3>
      <div className="mt-2 rounded-xl bg-sunk px-4 py-3 text-[0.92rem] leading-relaxed text-ink-2">
        {o.spentUsd == null ? (
          <p className="text-ink">{t.spend.unavailable(o.capUsd.toFixed(2))}</p>
        ) : (
          <>
            <p className="text-ink">{t.spend.spent(o.spentUsd.toFixed(2), o.capUsd.toFixed(2))}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule" aria-hidden>
              <div className={`h-full rounded-full ${o.spentUsd >= o.capUsd ? "bg-ume" : "bg-edamame"}`} style={{ width: `${Math.min(100, (o.spentUsd / o.capUsd) * 100)}%` }} />
            </div>
          </>
        )}
        <p className="mt-2">{t.spend.perUser(o.perUserCapUsd.toFixed(2))}</p>
        <p>{t.spend.model(t.spend.providers[o.provider], o.model)}</p>
        {o.fallbacks.length > 0 && <p>{t.spend.fallbacks(o.fallbacks.join(", "))}</p>}
        <p className="mt-1 text-[0.85rem] text-ink-3">{t.spend.changeNote}</p>
      </div>

      <h3 className="mt-6 text-[0.95rem] font-bold">{t.admins.heading}</h3>
      {added === "added" && <div className="mt-2"><Notice>{t.admins.added}</Notice></div>}
      {added === "removed" && <div className="mt-2"><Notice>{t.admins.removed}</Notice></div>}
      {error && <div className="mt-2"><ErrorNote message={t.admins.errors[error]} /></div>}
      <ul className="mt-2 divide-y divide-rule rounded-xl border border-rule">
        {o.admins.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="mono min-w-0 break-all text-[0.88rem] text-ink">{a.email}</span>
            {a.id === you && <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.75rem] text-ink-2">{t.admins.you}</span>}
            <span className="text-[0.8rem] text-ink-3">{t.admins.since(date(a.since))}</span>
            {a.id !== you && o.admins.length > 1 && (
              <form action={removeAdmin} className="ml-auto">
                <input type="hidden" name="userId" value={a.id} />
                <ConfirmButton message={t.admins.removeConfirm(a.email)} pending={copy.common.saving} aria-label={t.admins.removeLabel(a.email)} className="min-h-9 rounded-full px-3.5 text-[0.84rem] font-medium text-ink-2 hover:bg-ume-soft hover:text-ume">
                  {t.admins.remove}
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </ul>

      <form action={addAdmin} className="mt-4 flex max-w-md flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="admin-email" className={fieldLabel}>{t.admins.addLabel}</label>
          {/* Keyed by the roster size: emptied after a change, kept after a refusal so it can be corrected. */}
          <input key={o.admins.length} id="admin-email" name="email" type="email" required autoComplete="off" aria-describedby="admin-email-hint" className={fieldInput} />
        </div>
        <ConfirmButton message={t.admins.addConfirm} pending={copy.common.saving} className="min-h-11 rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
          {t.admins.add}
        </ConfirmButton>
        <p id="admin-email-hint" className="w-full text-[0.8rem] text-ink-3">{t.admins.addHint}</p>
      </form>
    </section>
  );
}
