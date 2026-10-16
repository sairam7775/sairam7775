"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/** Settings → Theme. "system" clears the cookie rather than storing it. */
export async function setTheme(formData: FormData) {
  const theme = parseTheme(String(formData.get("theme") ?? ""));
  const jar = await cookies();
  if (theme === "system") jar.delete(THEME_COOKIE);
  else {
    jar.set(THEME_COOKIE, theme, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/settings");
}
