import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ageStatus } from "@/lib/age-gate";
import { safeNext } from "@/lib/safe-next";
import { googleSignInEnabled } from "@/lib/auth-config";
import { confirmAge, signUpWithPassword, signInWithGoogle } from "../actions";
import { AsidePoint, AuthShell, Divider, ErrorNote, Field, GoogleButton, Notice, Submit } from "../ui";

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

  return (
    <AuthShell
      title="Start planning"
      subtitle="An account keeps your plan — and the confirmation numbers you add to it — here tomorrow, and on your phone in Japan."
      aside={
        <>
          <div>
            <p lang="ja" className="disp text-[1.4rem] font-bold text-accent">はじめまして</p>
            <p className="mt-1 text-[0.9rem] text-rice/70">“Nice to meet you” — said once, at the start.</p>
          </div>
          <ul className="flex flex-col gap-5">
            <AsidePoint tone="accent" title="Tell Bento Man the trip">
              Dates, who’s going, what you like and what you’d never do. A few questions, not a form.
            </AsidePoint>
            <AsidePoint tone="tamago" title="Get a route that adds up">
              Cities and nights with the train time shown. Over-packed plans are refused, with the arithmetic.
            </AsidePoint>
            <AsidePoint tone="edamame" title="Each day as a box">
              Stops sized to the time they take. Nothing changes until you accept it.
            </AsidePoint>
          </ul>
        </>
      }
    >
      <ErrorNote message={error} />

      {age === "blocked" && (
        <Notice>Sorry, we can’t create an account for you.</Notice>
      )}

      {age === "unknown" && (
        <form action={confirmAge} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="birthdate" name="birthdate" type="date" label="Date of birth" autoComplete="bday" max={today} hint="We use this once, to check you can sign up, and don’t keep it." />
          <Submit label="Continue" pending="Checking…" />
        </form>
      )}

      {age === "ok" && (
        <>
          {sent && <Notice>Check your email for a confirmation link, then come back and sign in.</Notice>}

          {googleSignInEnabled() && (
            <>
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={next} />
                <GoogleButton label="Continue with Google" />
              </form>

              <Divider label="or with your email" />
            </>
          )}

          <form action={signUpWithPassword} className="flex flex-col gap-4">
            <Field id="email" name="email" type="email" label="Email" autoComplete="email" placeholder="you@example.com" />
            <Field id="password" name="password" type="password" label="Password" autoComplete="new-password" hint="At least 8 characters." />
            <Submit label="Create account" pending="Creating your account…" />
          </form>
        </>
      )}

      <p className="mt-6 text-[0.92rem] text-ink-2">
        Already have an account?{" "}
        <Link href={next === "/trips" ? "/sign-in" : `/sign-in?${new URLSearchParams({ next })}`} className="font-medium text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
