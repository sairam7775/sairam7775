import type { Metadata, Viewport } from "next";
import "@fontsource/zen-maru-gothic/700.css";
import "@fontsource/zen-maru-gothic/900.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/500.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";
import { SeasonalBackground } from "@/components/seasonal/background";

/* Fonts are self-hosted (fontsource) rather than fetched at build time, so
   a build works offline and a traveller on airport wifi never waits on a
   font CDN. Zen Maru Gothic for headlines, Zen Kaku Gothic New body, DM Mono
   data. Both Zen faces are Japanese typefaces with Latin designed to match,
   so place names in Japanese set in the same voice as the English around
   them; each weight is split by unicode-range and only the ranges a page
   uses are downloaded. */

export const metadata: Metadata = {
  title: "Bento — plan Japan properly",
  description:
    "A trip planner for people who have never been to Japan. Real travel times, honest expectations, and a plan that tells you what's still missing.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#171213" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SeasonalBackground>{children}</SeasonalBackground>
      </body>
    </html>
  );
}
