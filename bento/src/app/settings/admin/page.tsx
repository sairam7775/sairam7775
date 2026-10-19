import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { ConfirmButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { hasTwoFactorSession, isAdmin } from "@/lib/admin";
import { adminOverview } from "@/lib/admin-overview";
import { createAdminClient } from "@/lib/supabase/admin";
import { copy } from "@/copy";
import { addAdmin, removeAdmin } from "../admin-actions";
import { parseAdminError } from "../admin-errors";
import { SETTINGS } from "../paths";
import { SettingsPage, signedIn } from "../ui";

/** Settings → Admin, for admins only: the curation tools, this month's AI
 *  spend and model, and who else is an admin. Anyone else goes back to the
 *  list. The actions check admin rights again themselves. */
export default async function Admin({ searchParams }: PageProps<"/settings/admin">) {
  const { supabase, user } = await signedIn(SETTINGS.admin);
  if (!(await isAdmin(supabase, user.id))) redirect(SETTINGS.home);
  // An admin without a second factor this session sets one up or enters it first.
  if (!(await hasTwoFactorSession(supabase))) redirect(SETTINGS.twoFactor);
  // Read with the service role, so only once the viewer is known to be an admin.
  const o = await adminOverview(createAdminClient());
  const sp = await searchParams;
  const error = parseAdminError(sp.adminError);
  const t = copy.settings.admin;
  const link = "inline-flex min-h-10 items-center rounded-full border border-rule px-4 text-[0.9rem] hover:bg-sunk";
  const date = (iso: string) => new Date(iso).toLocaleDateString(copy.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <SettingsPage title={t.heading} userId={user.id}>
      <p className="up mt-2 text-[0.9rem] text-ink-3">{t.body}</p>

      <section className="tile up mt-6 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.tools.heading}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li><Link href="/admin" className={link}>{t.tools.curation}</Link></li>
          <li><Link href="/admin/review" className={link}>{o.toCheck == null ? t.tools.reviewPlain : t.tools.review(o.toCheck)}</Link></li>
          {o.toCheck !== 0 && <li><Link href="/admin/review/bulk" className={link}>{t.tools.bulk}</Link></li>}
          <li><Link href="/admin/trip-reviews" className={link}>{o.tripReviews == null ? t.tools.tripReviewsPlain : t.tools.tripReviews(o.tripReviews)}</Link></li>
        </ul>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.spend.heading}</h2>
        <div className="mt-3 rounded-xl bg-sunk px-4 py-3 text-[0.92rem] leading-relaxed text-ink-2">
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
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">{t.admins.heading}</h2>
        {sp.admin === "added" && <div className="mt-3"><Notice>{t.admins.added}</Notice></div>}
        {sp.admin === "removed" && <div className="mt-3"><Notice>{t.admins.removed}</Notice></div>}
        {error && <div className="mt-3"><ErrorNote message={t.admins.errors[error]} /></div>}
        <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule">
          {o.admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="mono min-w-0 break-all text-[0.88rem] text-ink">{a.email}</span>
              {a.id === user.id && <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.75rem] text-ink-2">{t.admins.you}</span>}
              <span className="text-[0.8rem] text-ink-3">{t.admins.since(date(a.since))}</span>
              {a.id !== user.id && o.admins.length > 1 && (
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
    </SettingsPage>
  );
}
