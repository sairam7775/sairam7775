import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/app/(auth)/ui";
import { replayTours } from "@/components/tour/actions";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";
import { setBackground, setTheme } from "./actions";
import { ChoiceButton, SubmitButton } from "@/components/form-controls";
import { BACKGROUND_COOKIE, parseBackground, type BackgroundChoice } from "@/components/seasonal/season";

const THEME_LABELS: [Theme, string][] = [["system", "System"], ["light", "Light"], ["dark", "Dark"]];
const BACKGROUND_LABELS: [BackgroundChoice, string][] = [
  ["auto", "Automatic"], ["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"],
];

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  const sp = await searchParams;
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
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
        <h2 id="theme-heading" className="text-[1.1rem] font-bold">Theme</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          System follows your device. The choice is kept on this device.
        </p>
        <form action={setTheme} role="group" aria-labelledby="theme-heading" className="mt-4 inline-flex rounded-full border border-rule p-1">
          {THEME_LABELS.map(([value, label]) => (
            <ChoiceButton
              key={value}
              name="theme"
              value={value}
              pressed={theme === value}
              className={`min-h-10 rounded-full px-4 text-[0.92rem] ${theme === value ? "bg-lacquer text-rice" : "text-ink-2 hover:bg-sunk hover:text-ink"}`}
            >
              {label}
            </ChoiceButton>
          ))}
        </form>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 id="background-heading" className="text-[1.1rem] font-bold">Background</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          The scene behind every page. Automatic follows today&rsquo;s date, and a trip&rsquo;s own dates on its page. Kept on this device.
        </p>
        <form action={setBackground} role="group" aria-labelledby="background-heading" className="mt-4 flex flex-wrap gap-2">
          {BACKGROUND_LABELS.map(([value, label]) => (
            <ChoiceButton
              key={value}
              name="background"
              value={value}
              pressed={background === value}
              className={`min-h-10 rounded-full border px-4 text-[0.92rem] ${background === value ? "border-lacquer bg-lacquer text-rice" : "border-rule text-ink-2 hover:bg-sunk hover:text-ink"}`}
            >
              {label}
            </ChoiceButton>
          ))}
        </form>
      </section>

      <section className="tile up mt-4 p-6">
        <h2 className="text-[1.1rem] font-bold">Tour</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          The short walkthrough of your trips, a trip and its vault. It starts again on the trips list, then on each page as you open it.
        </p>
        <form action={replayTours}>
          <SubmitButton pending="Opening…" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
            Show the tour again
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
