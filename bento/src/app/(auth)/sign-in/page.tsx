import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { googleSignInEnabled } from "@/lib/auth-config";
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

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off — your route, your days, and what’s still missing."
      aside={
        <>
          <div>
            <p lang="ja" className="disp text-[1.4rem] font-bold text-accent">おかえりなさい</p>
            <p className="mt-1 text-[0.9rem] text-rice/70">“Welcome home” — what a ryokan says when you come back in from the cold.</p>
          </div>
          <ul className="flex flex-col gap-5">
            <AsidePoint tone="accent" title="Your plan, as you left it">
              Every accepted day, every pinned stop, and the conversation with Bento Man.
            </AsidePoint>
            <AsidePoint tone="ume" title="The gaps, still flagged">
              A night with no bed or a train with no ticket stays on the list until it’s booked.
            </AsidePoint>
            <AsidePoint tone="edamame" title="Bookings in one place">
              Confirmation numbers are encrypted, and only you can see them.
            </AsidePoint>
          </ul>
        </>
      }
    >
      <ErrorNote message={error} />

      {googleSignInEnabled() && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleButton label="Continue with Google" />
          </form>

          <Divider label="or with your email" />
        </>
      )}

      <form action={signInWithPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" placeholder="you@example.com" />
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" />
        <Link href="/forgot-password" className="-mt-1 self-start text-[0.88rem] text-ink-2 underline underline-offset-2 hover:text-ink">
          Forgot password?
        </Link>
        <Submit label="Sign in" pending="Signing in…" />
      </form>

      <p className="mt-6 text-[0.92rem] text-ink-2">
        New to Bento?{" "}
        <Link href="/sign-up" className="font-medium text-accent underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
