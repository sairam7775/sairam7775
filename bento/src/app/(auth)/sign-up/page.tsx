import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUpWithPassword, signInWithGoogle } from "../actions";
import { AuthShell, Field, Submit, GoogleButton, ErrorNote, Notice } from "../ui";

export default async function SignUp({ searchParams }: PageProps<"/sign-up">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/trips");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";

  return (
    <AuthShell
      title="Create an account"
      subtitle="So your plan, and the confirmation numbers you add to it, are still here tomorrow."
    >
      <ErrorNote message={error} />
      {sent && (
        <Notice>
          Check your email for a confirmation link, then sign in.
        </Notice>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value="/trips" />
        <GoogleButton label="Continue with Google" />
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-3">
          or
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form action={signUpWithPassword} className="flex flex-col gap-4">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" />
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <Submit label="Create account" />
      </form>

      <p className="mt-6 text-sm text-ink-2">
        Already have one?{" "}
        <Link href="/sign-in" className="text-indigo underline underline-offset-2">
          Sign in
        </Link>
        .
      </p>
    </AuthShell>
  );
}
