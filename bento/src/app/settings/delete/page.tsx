import { deleteAccount } from "@/app/(auth)/actions";
import { ErrorNote, Field } from "@/app/(auth)/ui";
import { ConfirmButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { googleOnly } from "@/lib/account/identity";
import { copy } from "@/copy";
import { SETTINGS } from "../paths";
import { SettingsPage, signedIn } from "../ui";

/** Settings → Privacy & data → Delete account. Confirmed with the password,
 *  or for a Google-only account the email typed out; the warning comes only
 *  once that's filled in. A refusal comes back here with the reason. */
export default async function DeleteAccount({ searchParams }: PageProps<"/settings/delete">) {
  const { user } = await signedIn(SETTINGS.deleteAccount);
  const sp = await searchParams;
  const viaGoogle = googleOnly(user);
  const t = copy.settings.deleteAccount;

  return (
    <SettingsPage title={t.heading} userId={user.id} back={{ href: SETTINGS.privacy, label: copy.settings.privacy.title }}>
      <section className="tile up mt-6 p-6">
        <p className="text-[0.95rem] leading-relaxed text-ink-2">{t.body}</p>
        <div className="mt-5">
          <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
          <form action={deleteAccount} className="flex max-w-sm flex-col gap-4">
            {viaGoogle ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delete-email" className={fieldLabel}>{t.email}</label>
                <input id="delete-email" name="email" type="email" required autoComplete="off" placeholder={user.email ?? ""} className={fieldInput} />
              </div>
            ) : (
              <Field id="delete-password" name="password" type="password" label={t.password} autoComplete="current-password" />
            )}
            <ConfirmButton message={t.confirm} pending={t.pending} className="self-start min-h-11 rounded-full border border-ume px-5 text-[0.95rem] font-medium text-ume hover:bg-ume-soft">
              {t.submit}
            </ConfirmButton>
          </form>
        </div>
      </section>
    </SettingsPage>
  );
}
