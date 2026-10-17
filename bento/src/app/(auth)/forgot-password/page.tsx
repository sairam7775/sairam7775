import Link from "next/link";
import { copy } from "@/copy";
import { AnalyticsSignedOut, AnalyticsUser } from "@/components/analytics/analytics";
import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset } from "../actions";
import { AsidePoint, AuthShell, ErrorNote, Field, Notice, Submit } from "../ui";

export default async function ForgotPassword({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  // Reachable signed in too (Settings → "Forgot your current one?").
  const { data: { user } } = await (await createClient()).auth.getUser();
  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";
  const t = copy.auth.forgot;

  return (
    <AuthShell
      title={t.title}
      subtitle={t.subtitle}
      aside={
        <ul className="flex flex-col gap-5">
          <AsidePoint tone="accent" title={t.points.once.title}>{t.points.once.body}</AsidePoint>
          <AsidePoint tone="edamame" title={t.points.unchanged.title}>{t.points.unchanged.body}</AsidePoint>
        </ul>
      }
    >
      {user ? <AnalyticsUser id={user.id} /> : <AnalyticsSignedOut />}
      <ErrorNote message={error} />
      {sent ? <Notice>{t.sent}</Notice> : null}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <Field id="email" name="email" type="email" label={copy.auth.email} autoComplete="email" placeholder={copy.auth.emailPlaceholder} />
        <Submit label={sent ? t.again : t.submit} pending={t.pending} />
      </form>

      <p className="mt-6 text-[0.92rem] text-ink-2">
        {t.remembered}{" "}
        <Link href="/sign-in" className="font-medium text-accent underline underline-offset-2">
          {copy.common.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}
