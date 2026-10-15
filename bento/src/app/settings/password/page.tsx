import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { inPasswordReset, PASSWORD_RESET_COOKIE } from "@/lib/auth-config";
import { updatePassword } from "@/app/(auth)/actions";
import { ErrorNote, Field, Submit } from "@/app/(auth)/ui";

export default async function ChangePassword({ searchParams }: PageProps<"/settings/password">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=" + encodeURIComponent("Your reset link expired. Ask for a new one."));
  const reset = inPasswordReset((await cookies()).get(PASSWORD_RESET_COOKIE)?.value, user.id);
  const sp = await searchParams;

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/settings", label: "Settings" }} />
      <section className="tile up mt-8 p-6 sm:p-8">
        <h1 className="text-[1.8rem] font-bold leading-tight">{reset ? "Choose a new password" : "Change password"}</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          {reset ? "You're signed in from the reset link. Pick a password you haven't used here before." : "At least 8 characters."}
        </p>
        <div className="mt-6">
          <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
          <form action={updatePassword} className="flex flex-col gap-4">
            {!reset && <Field id="current" name="current" type="password" label="Current password" autoComplete="current-password" />}
            <Field id="password" name="password" type="password" label="New password" autoComplete="new-password" hint="At least 8 characters." />
            <Field id="confirm" name="confirm" type="password" label="New password again" autoComplete="new-password" />
            <Submit label="Save password" pending="Saving…" />
          </form>
          {!reset && (
            <p className="mt-6 text-[0.9rem] text-ink-2">
              Forgot your current one?{" "}
              <Link href="/forgot-password" className="font-medium text-accent underline underline-offset-2">Reset it by email</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
