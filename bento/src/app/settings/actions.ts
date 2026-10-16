"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { THEME_COOKIE, THEMES } from "@/lib/theme";
import { BACKGROUND_COOKIE, BACKGROUNDS } from "@/components/seasonal/season";

const KEEP = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 } as const;

/** Settings → Theme. "system" clears the cookie rather than storing it; an
 *  unknown value changes nothing. */
export async function setTheme(formData: FormData) {
  const parsed = z.enum(THEMES).safeParse(formData.get("theme"));
  if (!parsed.success) redirect("/settings");
  const jar = await cookies();
  if (parsed.data === "system") jar.delete(THEME_COOKIE);
  else {
    jar.set(THEME_COOKIE, parsed.data, { ...KEEP, secure: process.env.NODE_ENV === "production" });
  }
  redirect("/settings");
}

/** Settings → Background. "auto" clears the cookie; an unknown value
 *  changes nothing. */
export async function setBackground(formData: FormData) {
  const parsed = z.enum(BACKGROUNDS).safeParse(formData.get("background"));
  if (!parsed.success) redirect("/settings");
  const jar = await cookies();
  if (parsed.data === "auto") jar.delete(BACKGROUND_COOKIE);
  else jar.set(BACKGROUND_COOKIE, parsed.data, { ...KEEP, secure: process.env.NODE_ENV === "production" });
  redirect("/settings");
}
