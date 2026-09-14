"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  const next = String(formData.get("next") ?? "/trips");
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

export async function signUpWithPassword(formData: FormData) {
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
  const next = String(formData.get("next") ?? "/trips");
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
