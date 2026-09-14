import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithPassword, signInWithGoogle } from "../actions";
import { AuthShell, Field, Submit, GoogleButton, ErrorNote } from "../ui";

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/trips");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const next = typeof params.next === "string" ? params.next : "/trips";

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your trips, bookings and preferences are waiting."
    >
      <ErrorNote message={error} />

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton label="Continue with Google" />
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-3">
          or
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form action={signInWithPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" />
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
        />
        <Submit label="Sign in" />
      </form>

      <p className="mt-6 text-sm text-ink-2">
        No account yet?{" "}
        <Link href="/sign-up" className="text-indigo underline underline-offset-2">
          Create one
        </Link>
        .
      </p>
    </AuthShell>
  );
}
