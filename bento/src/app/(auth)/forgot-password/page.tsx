import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { AsidePoint, AuthShell, ErrorNote, Field, Notice, Submit } from "../ui";

export default async function ForgotPassword({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send a link to choose a new password."
      aside={
        <ul className="flex flex-col gap-5">
          <AsidePoint tone="accent" title="The link works once">
            It signs you in and asks for a new password. It expires after an hour.
          </AsidePoint>
          <AsidePoint tone="edamame" title="Nothing in your plan changes">
            Trips, bookings and the conversation with Bento Man stay exactly as they are.
          </AsidePoint>
        </ul>
      }
    >
      <ErrorNote message={error} />
      {sent ? (
        <Notice>
          If there&rsquo;s an account for that address, a reset link is on its way. Check your inbox — and spam — in
          the next few minutes.
        </Notice>
      ) : null}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" placeholder="you@example.com" />
        <Submit label={sent ? "Send another link" : "Send reset link"} pending="Sending…" />
      </form>

      <p className="mt-6 text-[0.92rem] text-ink-2">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
