import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { inPasswordReset, PASSWORD_RESET_COOKIE } from "@/lib/auth-config";
import { updatePassword } from "@/app/(auth)/actions";
import { ErrorNote, Field, Submit } from "@/app/(auth)/ui";
import { copy } from "@/copy";

export default async function ChangePassword({ searchParams }: PageProps<"/settings/password">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=" + encodeURIComponent(copy.auth.errors.resetExpired));
  const reset = inPasswordReset((await cookies()).get(PASSWORD_RESET_COOKIE)?.value, user.id);
  const sp = await searchParams;
  const t = copy.auth.changePassword;

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/settings", label: copy.common.settings }} />
      <section className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-[1.8rem] font-bold leading-tight">{reset ? t.resetTitle : t.changeTitle}</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{reset ? t.resetSubtitle : t.changeSubtitle}</p>
        <div className="mt-6">
          <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
          <form action={updatePassword} className="flex flex-col gap-4">
            {!reset && <Field id="current" name="current" type="password" label={t.current} autoComplete="current-password" />}
            <Field id="password" name="password" type="password" label={t.new} autoComplete="new-password" hint={copy.auth.passwordHint} />
            <Field id="confirm" name="confirm" type="password" label={t.again} autoComplete="new-password" />
            <Submit label={t.submit} pending={copy.common.saving} />
          </form>
          {!reset && (
            <p className="mt-6 text-[0.9rem] text-ink-2">
              {t.forgotCurrent}{" "}
              <Link href="/forgot-password" className="font-medium text-accent-ink underline underline-offset-2">{t.resetByEmail}</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
