import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";

/* Fonts are self-hosted (fontsource) rather than fetched at build time, so
   a build works offline and a traveller on airport wifi never waits on a
   font CDN. Bricolage Grotesque for headlines, DM Sans body, DM Mono data —
   the set the design canvas uses. */

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
