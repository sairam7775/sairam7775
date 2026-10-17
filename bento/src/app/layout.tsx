import type { Metadata, Viewport } from "next";
import "@fontsource/zen-maru-gothic/700.css";
import "@fontsource/zen-maru-gothic/900.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import { cookies } from "next/headers";
import "./globals.css";
import { SeasonalBackground } from "@/components/seasonal/background";
import { BACKGROUND_COOKIE, parseBackground } from "@/components/seasonal/season";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { copy } from "@/copy";

/* Fonts are self-hosted (fontsource) rather than fetched at build time, so
   a build works offline and a traveller on airport wifi never waits on a
   font CDN. Zen Maru Gothic for headlines, Zen Kaku Gothic New body, DM Mono
   data. Both Zen faces are Japanese typefaces with Latin designed to match,
   so place names in Japanese set in the same voice as the English around
   them; each weight is split by unicode-range and only the ranges a page
   uses are downloaded. */

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
};

const PAPER = { light: "#fbf8f3", dark: "#171213" };

/** The browser bar matches the page: the chosen theme (Settings), or the
 *  device setting when none is chosen. */
export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    viewportFit: "cover",
    themeColor: theme === "system"
      ? [
          { media: "(prefers-color-scheme: light)", color: PAPER.light },
          { media: "(prefers-color-scheme: dark)", color: PAPER.dark },
        ]
      : PAPER[theme],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const background = parseBackground(jar.get(BACKGROUND_COOKIE)?.value);
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-full flex flex-col">
        <SeasonalBackground chosen={background === "auto" ? null : background}>{children}</SeasonalBackground>
      </body>
    </html>
  );
}
