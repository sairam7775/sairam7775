import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/app/(auth)/ui";
import { replayTours } from "@/components/tour/actions";

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  const sp = await searchParams;
  const viaGoogle = user.app_metadata?.provider === "google" && !(user.identities ?? []).some((i) => i.provider === "email");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/trips", label: "Your trips" }} />
      <h1 className="up mt-8 text-3xl font-bold tracking-tight">Settings</h1>

      <div className="mt-6">{sp.updated === "password" && <Notice>Your password was changed.</Notice>}</div>

      <section className="tile up mt-2 p-6">
        <h2 className="text-[1.1rem] font-bold">Account</h2>
        <p className="mono mt-2 break-all text-[0.9rem] text-ink-2">{user.email}</p>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">Password</h2>
        {viaGoogle ? (
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">You sign in with Google, so there&rsquo;s no Bento password to change.</p>
        ) : (
          <>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">Change the password you sign in with.</p>
            <Link href="/settings/password" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
              Change password
            </Link>
          </>
        )}
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">Tour</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          The short walkthrough of your trips, a trip and its vault. It starts again on the trips list, then on each page as you open it.
        </p>
        <form action={replayTours}>
          <button className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
            Show the tour again
          </button>
        </form>
      </section>
    </main>
  );
}
