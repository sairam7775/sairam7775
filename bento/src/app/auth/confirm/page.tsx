import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { copy } from "@/copy";
import { AnalyticsSignedOut, AnalyticsUser } from "@/components/analytics/analytics";
import { PASSWORD_RESET_PATH } from "@/lib/auth-config";
import { openPendingSignIn, PENDING_SIGN_IN_COOKIE } from "@/lib/pending-sign-in";
import { createClient } from "@/lib/supabase/server";
import { cancelSignIn, confirmSignIn } from "@/app/(auth)/actions";
import { AsidePoint, AuthShell, Notice, Submit } from "@/app/(auth)/ui";

/** Where an email link's sign-in waits for the visitor to say the account
 *  is theirs (lib/pending-sign-in.ts). The address is shown before anything
 *  is signed in, so a link someone forwarded from their own inbox shows
 *  their address, not a signed-in page. */
export default async function ConfirmSignIn() {
  const pending = openPendingSignIn((await cookies()).get(PENDING_SIGN_IN_COOKIE)?.value);
  if (!pending) redirect(`/sign-in?${new URLSearchParams({ error: copy.auth.errors.signInLinkUsed })}`);

  const { data: { user } } = await (await createClient()).auth.getUser();
  const t = copy.auth.confirm;

  return (
    <AuthShell
      title={t.title}
      subtitle={pending.next.startsWith(PASSWORD_RESET_PATH) ? t.reset : t.signIn}
      aside={
        <ul className="flex flex-col gap-5">
          <AsidePoint tone="accent" title={t.points.once.title}>{t.points.once.body}</AsidePoint>
          <AsidePoint tone="edamame" title={copy.auth.signIn.points.bookings.title}>{copy.auth.signIn.points.bookings.body}</AsidePoint>
        </ul>
      }
    >
      {user ? <AnalyticsUser id={user.id} /> : <AnalyticsSignedOut />}
      <p className="break-all rounded-xl border border-rule bg-sunk px-4 py-3 text-[1.05rem] font-semibold">{pending.email}</p>
      {user && user.id !== pending.userId ? (
        <div className="mt-4">
          <Notice>{t.switching(user.email ?? "")}</Notice>
        </div>
      ) : null}
      <p className="mt-4 text-[0.92rem] leading-relaxed text-ink-2">{t.check}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form action={confirmSignIn} className="flex">
          {/* Continue signs in to this account only (confirmSignIn). */}
          <input type="hidden" name="account" value={pending.userId} />
          <Submit label={t.continue} pending={t.pending} />
        </form>
        <form action={cancelSignIn} className="flex">
          <button type="submit" className="mt-2 min-h-11 rounded-full px-4 text-[0.92rem] text-ink-2 underline underline-offset-2 hover:bg-sunk hover:text-ink">
            {t.notMe}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
