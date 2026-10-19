"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { THEME_COOKIE, THEMES } from "@/lib/theme";
import { BACKGROUND_COOKIE, BACKGROUNDS } from "@/components/seasonal/season";
import { ANALYTICS_COOKIE } from "@/lib/analytics/consent";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanName } from "@/lib/account/name";
import { SETTINGS } from "./paths";

const KEEP = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 } as const;

// No redirect after saving: setting a cookie in an action re-renders the page
// in place, so the traveller stays where they tapped. A redirect to the same
// page scrolled them back to the top.

/** Settings → Theme. "system" clears the cookie rather than storing it; an
 *  unknown value changes nothing. */
export async function setTheme(formData: FormData) {
  const parsed = z.enum(THEMES).safeParse(formData.get("theme"));
  if (!parsed.success) return;
  const jar = await cookies();
  if (parsed.data === "system") jar.delete(THEME_COOKIE);
  else jar.set(THEME_COOKIE, parsed.data, { ...KEEP, secure: process.env.NODE_ENV === "production" });
}

/** Settings → Background. "auto" clears the cookie; an unknown value
 *  changes nothing. */
export async function setBackground(formData: FormData) {
  const parsed = z.enum(BACKGROUNDS).safeParse(formData.get("background"));
  if (!parsed.success) return;
  const jar = await cookies();
  if (parsed.data === "auto") jar.delete(BACKGROUND_COOKIE);
  else jar.set(BACKGROUND_COOKIE, parsed.data, { ...KEEP, secure: process.env.NODE_ENV === "production" });
}

/** The consent banner and Settings → Usage analytics. Both answers are
 *  stored, so the banner never asks again; the client starts or stops
 *  PostHog when the page re-renders with the new answer. */
export async function setAnalytics(formData: FormData) {
  const parsed = z.enum(["yes", "no"]).safeParse(formData.get("analytics"));
  if (!parsed.success) return;
  (await cookies()).set(ANALYTICS_COOKIE, parsed.data, { ...KEEP, secure: process.env.NODE_ENV === "production" });
}

/** How saving a name went, for the form to say so; null before the first try. */
export type NameState = "saved" | "failed" | null;

/** Settings → Personal information → Your name. Kept in the account's own
 *  metadata. An empty name is saved too, so a Google first name doesn't come
 *  back once cleared (lib/account/name.ts). */
export async function setDisplayName(_prev: NameState, formData: FormData): Promise<NameState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${SETTINGS.personal}`);
  const { error } = await supabase.auth.updateUser({ data: { display_name: cleanName(formData.get("name")) } });
  if (error) {
    console.error("Saving a name failed:", error.message);
    return "failed";
  }
  return "saved";
}
