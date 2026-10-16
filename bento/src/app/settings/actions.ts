"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { THEME_COOKIE, THEMES } from "@/lib/theme";

/** Settings → Theme. "system" clears the cookie rather than storing it; an
 *  unknown value changes nothing. */
export async function setTheme(formData: FormData) {
  const parsed = z.enum(THEMES).safeParse(formData.get("theme"));
  if (!parsed.success) redirect("/settings");
  const jar = await cookies();
  if (parsed.data === "system") jar.delete(THEME_COOKIE);
  else {
    jar.set(THEME_COOKIE, parsed.data, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/settings");
}
