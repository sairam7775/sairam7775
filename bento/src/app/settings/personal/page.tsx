import Link from "next/link";
import { Notice } from "@/app/(auth)/ui";
import { googleOnly } from "@/lib/account/identity";
import { displayName } from "@/lib/account/name";
import { copy } from "@/copy";
import { SETTINGS } from "../paths";
import { SettingsPage, signedIn } from "../ui";
import { NameForm } from "./name-form";

/** Settings → Personal information: the email and how they sign in, their
 *  name, and the way to a new password. One card, a part each. */
export default async function PersonalInformation({ searchParams }: PageProps<"/settings/personal">) {
  const { user } = await signedIn(SETTINGS.personal);
  const sp = await searchParams;
  const viaGoogle = googleOnly(user);
  const t = copy.settings;

  return (
    <SettingsPage title={t.personal.title} userId={user.id}>
      <div className="mt-6">{sp.updated === "password" && <Notice>{t.passwordChanged}</Notice>}</div>

      <div className="tile up mt-2 divide-y divide-rule">
        <section className="p-6">
          <h2 className="text-[1.1rem] font-bold">{t.personal.email}</h2>
          <p className="mono mt-2 break-all text-[0.9rem] text-ink">{user.email}</p>
          <p className="mt-1 text-[0.9rem] text-ink-2">{viaGoogle ? t.personal.viaGoogle : t.personal.viaPassword}</p>
        </section>

        <section className="p-6">
          <h2 className="text-[1.1rem] font-bold">{t.name.heading}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.name.body}</p>
          <NameForm name={displayName(user) ?? ""} />
        </section>

        <section className="p-6">
          <h2 className="text-[1.1rem] font-bold">{t.password.heading}</h2>
          {viaGoogle ? (
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.password.google}</p>
          ) : (
            <>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.password.body}</p>
              <Link href={SETTINGS.password} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
                {t.password.change}
              </Link>
            </>
          )}
        </section>
      </div>
    </SettingsPage>
  );
}
