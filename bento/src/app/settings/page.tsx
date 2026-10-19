import { cookies } from "next/headers";
import { replayTours } from "@/components/tour/actions";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { BACKGROUND_COOKIE, parseBackground } from "@/components/seasonal/season";
import { ANALYTICS_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { displayName } from "@/lib/account/name";
import { isAdmin } from "@/lib/admin";
import { copy } from "@/copy";
import { SETTINGS } from "./paths";
import { appearanceSummary, personalSummary, privacySummary } from "./summary";
import { ActionRow, LinkRow, RowList, SettingsPage, signedIn } from "./ui";

/** Settings: a short list. Each row says what's set now and opens its
 *  group's own page; the tour row replays the tour straight away. */
export default async function Settings() {
  const { supabase, user } = await signedIn(SETTINGS.home);
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
  // Only where analytics can run: no key, nothing to mention.
  const analytics = process.env.NEXT_PUBLIC_POSTHOG_KEY ? parseConsent(jar.get(ANALYTICS_COOKIE)?.value) === "yes" : null;
  const admin = await isAdmin(supabase, user.id);
  const t = copy.settings;

  return (
    <SettingsPage title={t.title} userId={user.id} back={{ href: "/trips", label: copy.common.yourTrips }}>
      <RowList className="mt-6">
        <LinkRow href={SETTINGS.personal} title={t.rows.personal} summary={personalSummary(displayName(user) ?? "", user.email ?? "")} />
        <LinkRow href={SETTINGS.appearance} title={t.rows.appearance} summary={appearanceSummary(theme, background)} />
        <LinkRow href={SETTINGS.privacy} title={t.rows.privacy} summary={privacySummary(analytics)} />
      </RowList>
      <RowList>
        <ActionRow action={replayTours} title={t.tour.replay} pending={t.tour.pending} summary={t.rows.tourSummary} />
        {admin && <LinkRow href={SETTINGS.admin} title={t.rows.admin} summary={t.rows.adminSummary} />}
      </RowList>
    </SettingsPage>
  );
}
