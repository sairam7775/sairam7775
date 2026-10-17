import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { googleSignInEnabled } from "@/lib/auth-config";
import { copy } from "@/copy";
import { signInWithPassword, signInWithGoogle } from "../actions";
import { AsidePoint, AuthShell, Divider, ErrorNote, Field, GoogleButton, Submit } from "../ui";

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/trips");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const next = typeof params.next === "string" ? params.next : "/trips";
  const t = copy.auth.signIn;

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
            <AsidePoint tone="accent" title={t.points.plan.title}>{t.points.plan.body}</AsidePoint>
            <AsidePoint tone="ume" title={t.points.gaps.title}>{t.points.gaps.body}</AsidePoint>
            <AsidePoint tone="edamame" title={t.points.bookings.title}>{t.points.bookings.body}</AsidePoint>
          </ul>
        </>
      }
    >
      <ErrorNote message={error} />

      {googleSignInEnabled() && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleButton label={copy.auth.google} />
          </form>

          <Divider label={copy.auth.orEmail} />
        </>
      )}

      <form action={signInWithPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field id="email" name="email" type="email" label={copy.auth.email} autoComplete="email" placeholder={copy.auth.emailPlaceholder} />
        <Field id="password" name="password" type="password" label={copy.auth.password} autoComplete="current-password" />
        <Link href="/forgot-password" className="-mt-1 self-start text-[0.88rem] text-ink-2 underline underline-offset-2 hover:text-ink">
          {t.forgot}
        </Link>
        <Submit label={t.submit} pending={t.pending} />
      </form>

      <p className="mt-6 text-[0.92rem] text-ink-2">
        {t.newHere}{" "}
        <Link href="/sign-up" className="font-medium text-accent underline underline-offset-2">
          {t.createAccount}
        </Link>
      </p>
    </AuthShell>
  );
}
