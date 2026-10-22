import { redirect } from "next/navigation";
import { hasTwoFactorSession, isAdmin } from "@/lib/admin";
import { copy } from "@/copy";
import { SETTINGS } from "../../paths";
import { SettingsPage, signedIn } from "../../ui";
import { TwoFactorForm } from "./two-factor-form";

const t = copy.settings.twoFactor;

/** Settings → Admin → two-factor. Every admin page and action sends an
 *  admin here until this session has a second factor (lib/admin.ts). Set up
 *  once with an authenticator app; after that, a code each sign-in. */
export default async function TwoFactor() {
  const { supabase, user } = await signedIn(SETTINGS.twoFactor);
  if (!(await isAdmin(supabase, user.id))) redirect(SETTINGS.home);
  if (await hasTwoFactorSession(supabase)) redirect(SETTINGS.admin);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.all ?? []).find((f) => f.factor_type === "totp" && f.status === "verified") ?? null;

  return (
    <SettingsPage title={t.title} userId={user.id}>
      <section className="tile up mt-6 p-6">
        <p className="text-[0.95rem] leading-relaxed text-ink-2">{t.why}</p>
        <TwoFactorForm factorId={verified?.id ?? null} />
        <p className="mt-6 text-[0.84rem] text-ink-3">{t.lost}</p>
      </section>
    </SettingsPage>
  );
}
