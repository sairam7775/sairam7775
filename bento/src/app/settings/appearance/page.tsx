import { cookies } from "next/headers";
import { ChoiceButton } from "@/components/form-controls";
import { BACKGROUNDS, BACKGROUND_COOKIE, parseBackground } from "@/components/seasonal/season";
import { THEMES, THEME_COOKIE, parseTheme } from "@/lib/theme";
import { copy } from "@/copy";
import { setBackground, setTheme } from "../actions";
import { SETTINGS } from "../paths";
import { SettingsPage, signedIn } from "../ui";

/** Settings → Appearance: the theme and the background scene, both kept
 *  on this device. A choice saves in place, without moving the page. */
export default async function Appearance() {
  const { user } = await signedIn(SETTINGS.appearance);
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
  const t = copy.settings;

  return (
    <SettingsPage title={t.appearance.title} userId={user.id}>
      <div className="tile up mt-6 divide-y divide-rule">
        <section className="p-6">
          <h2 id="theme-heading" className="text-[1.1rem] font-bold">{t.theme.heading}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.theme.body}</p>
          <form action={setTheme} className="mt-4">
            <div role="group" aria-labelledby="theme-heading" className="inline-flex rounded-full border border-rule p-1">
              {THEMES.map((value) => (
                <ChoiceButton
                  key={value}
                  name="theme"
                  value={value}
                  pressed={theme === value}
                  className={`min-h-10 rounded-full px-4 text-[0.92rem] ${theme === value ? "bg-lacquer text-rice" : "text-ink-2 hover:bg-sunk hover:text-ink"}`}
                >
                  {t.theme[value]}
                </ChoiceButton>
              ))}
            </div>
          </form>
        </section>

        <section className="p-6">
          <h2 id="background-heading" className="text-[1.1rem] font-bold">{t.background.heading}</h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{t.background.body}</p>
          <form action={setBackground} className="mt-4">
            <div role="group" aria-labelledby="background-heading" className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((value) => (
                <ChoiceButton
                  key={value}
                  name="background"
                  value={value}
                  pressed={background === value}
                  className={`min-h-10 rounded-full border px-4 text-[0.92rem] ${background === value ? "border-lacquer bg-lacquer text-rice" : "border-rule text-ink-2 hover:bg-sunk hover:text-ink"}`}
                >
                  {t.background[value]}
                </ChoiceButton>
              ))}
            </div>
          </form>
        </section>
      </div>
    </SettingsPage>
  );
}
