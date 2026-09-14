import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const zen = Zen_Kaku_Gothic_New({
  variable: "--font-zen",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bento — plan Japan properly",
  description:
    "A trip planner for people who have never been to Japan. Real travel times, honest expectations, and a plan that tells you what's still missing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${zen.variable} ${newsreader.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
