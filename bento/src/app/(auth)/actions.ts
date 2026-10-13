"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { AGE_BLOCKED_COOKIE, AGE_OK_COOKIE, MIN_AGE, ageOn, ageStatus } from "@/lib/age-gate";

const credentials = z.object({
  email: z.email("That doesn't look like an email address."),
  password: z.string().min(8, "Passwords need at least 8 characters."),
});

function backTo(page: string, message: string, next?: string) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  return `${page}?${params.toString()}`;
}

async function origin() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
  );
}

export async function signInWithPassword(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(backTo("/sign-in", parsed.error.issues[0].message, next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: saying which half was wrong tells an attacker
    // whether an address has an account here.
    redirect(backTo("/sign-in", "That email and password don't match.", next));
  }

  redirect(next);
}

/** The neutral age screen (COPPA). The birth date is checked here and not
 *  kept; only the outcome is remembered, in a cookie. */
export async function confirmAge(formData: FormData) {
  const jar = await cookies();
  if (ageStatus(jar) === "blocked") redirect("/sign-up");

  const age = ageOn(String(formData.get("birthdate") ?? ""), new Date());
  if (age == null) redirect(backTo("/sign-up", "Enter your date of birth."));

  const year = 60 * 60 * 24 * 365;
  if (age < MIN_AGE) {
    // Remembered, so going back and typing another year doesn't get past it.
    jar.set(AGE_BLOCKED_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: year });
  } else {
    jar.set(AGE_OK_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: year });
  }
  redirect("/sign-up");
}

export async function signUpWithPassword(formData: FormData) {
  // A form posted straight at this action skips the page, so check here too.
  if (ageStatus(await cookies()) !== "ok") redirect("/sign-up");

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(backTo("/sign-up", parsed.error.issues[0].message));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });

  if (error) {
    redirect(backTo("/sign-up", error.message));
  }

  redirect("/sign-up?sent=1");
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  // Google sign-in creates an account for a new address, so it passes the
  // same age screen as email sign-up.
  const age = ageStatus(await cookies());
  if (age === "blocked") redirect(backTo("/sign-in", "Sorry, you can't use Bento.", next));
  if (age === "unknown") redirect(backTo("/sign-up", "One quick thing before you continue."));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(backTo("/sign-in", "Google sign-in is unavailable right now.", next));
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
