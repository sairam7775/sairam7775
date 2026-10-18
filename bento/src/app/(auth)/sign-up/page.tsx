import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ageStatus } from "@/lib/age-gate";
import { safeNext } from "@/lib/safe-next";
import { NAME_MAX } from "@/lib/account/name";
import { googleSignInEnabled } from "@/lib/auth-config";
import { copy } from "@/copy";
import { AnalyticsSignedOut } from "@/components/analytics/analytics";
import { confirmAge, signUpWithPassword, signInWithGoogle } from "../actions";
import { AgreeNote, AsidePoint, AuthShell, Divider, ErrorNote, Field, GoogleButton, Notice, Submit } from "../ui";

export default async function SignUp({ searchParams }: PageProps<"/sign-up">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const next = safeNext(params.next);
  if (user) redirect(next);

  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";
  const age = ageStatus(await cookies());
  const today = new Date().toISOString().slice(0, 10);
  const t = copy.auth.signUp;

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      aside={
        <>
          <div>
            <p lang="ja" className="disp text-[1.4rem] font-bold text-accent">{t.greeting}</p>
            <p className="mt-1 text-[0.9rem] text-rice/70">{t.greetingMeaning}</p>
          </div>
          <ul className="flex flex-col gap-5">
            <AsidePoint tone="accent" title={t.points.tell.title}>{t.points.tell.body}</AsidePoint>
            <AsidePoint tone="tamago" title={t.points.route.title}>{t.points.route.body}</AsidePoint>
            <AsidePoint tone="edamame" title={t.points.days.title}>{t.points.days.body}</AsidePoint>
          </ul>
        </>
      }
    >
      <AnalyticsSignedOut />
      <ErrorNote message={error} />

      {age === "blocked" && <Notice>{t.blocked}</Notice>}

      {age === "unknown" && (
        <form action={confirmAge} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="birthdate" name="birthdate" type="date" label={t.birthdate} autoComplete="bday" max={today} hint={t.birthdateHint} />
          <Submit label={t.continue} pending={t.checking} />
        </form>
      )}

      {age === "ok" && (
        <>
          {sent && <Notice>{t.sent}</Notice>}

          {googleSignInEnabled() && (
            <>
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={next} />
                <GoogleButton label={copy.auth.google} />
              </form>

              <Divider label={copy.auth.orEmail} />
            </>
          )}

          <form action={signUpWithPassword} className="flex flex-col gap-4">
            <Field id="name" name="name" type="text" label={t.name} autoComplete="given-name" hint={t.nameHint} optional maxLength={NAME_MAX} />
            <Field id="email" name="email" type="email" label={copy.auth.email} autoComplete="email" placeholder={copy.auth.emailPlaceholder} />
            <Field id="password" name="password" type="password" label={copy.auth.password} autoComplete="new-password" hint={copy.auth.passwordHint} />
            <Submit label={t.submit} pending={t.pending} />
          </form>

          {/* Under both ways in, so it covers Continue with Google too. */}
          <AgreeNote start={t.agree.start} />
        </>
      )}

      <p className="mt-6 text-[0.92rem] text-ink-2">
        {t.haveAccount}{" "}
        <Link href={next === "/trips" ? "/sign-in" : `/sign-in?${new URLSearchParams({ next })}`} className="font-medium text-accent-ink underline underline-offset-2">
          {copy.common.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}
