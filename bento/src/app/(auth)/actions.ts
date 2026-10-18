"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { siteOrigin } from "@/lib/site-origin";
import { authErrorMessage } from "@/lib/friendly-errors";
import { googleSignInEnabled, inPasswordReset, PASSWORD_RESET_COOKIE } from "@/lib/auth-config";
import { AGE_BLOCKED_COOKIE, AGE_OK_COOKIE, MIN_AGE, ageOn, ageStatus, secondsUntilEligible } from "@/lib/age-gate";
import { copy } from "@/copy";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccountData, postHogDeleter } from "@/lib/account/delete";
import { googleOnly } from "@/lib/account/identity";

const credentials = z.object({
  email: z.email(copy.auth.errors.badEmail),
  password: z.string().min(8, copy.auth.errors.shortPassword),
});

function backTo(page: string, message: string, next?: string) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  return `${page}?${params.toString()}`;
}

async function origin() {
  return siteOrigin(await headers());
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

  // A new sign-in is never a password reset, whatever was left in this browser.
  (await cookies()).delete(PASSWORD_RESET_COOKIE);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Only reachable with the right password, so it gives nothing away.
    if (error.code === "email_not_confirmed") redirect(backTo("/sign-in", authErrorMessage(error), next));
    if (error.status === 429) redirect(backTo("/sign-in", authErrorMessage(error), next));
    // Deliberately vague: saying which half was wrong tells an attacker
    // whether an address has an account here.
    redirect(backTo("/sign-in", copy.auth.errors.wrongPassword, next));
  }

  redirect(next);
}

/** The neutral age screen (16 and over, lib/age-gate.ts). The birth date
 *  is checked here and not kept; only the outcome is remembered, in a
 *  cookie. */
export async function confirmAge(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const back = `/sign-up?${new URLSearchParams({ next })}`;
  const jar = await cookies();
  if (ageStatus(jar) === "blocked") redirect(back);

  const now = new Date();
  const dob = String(formData.get("birthdate") ?? "");
  const age = ageOn(dob, now);
  if (age == null) redirect(backTo("/sign-up", copy.auth.errors.noBirthdate, next));

  const cookie = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;
  if (age < MIN_AGE) {
    // Remembered, so going back and typing another year doesn't get past it —
    // but only until the birthday that makes them eligible.
    jar.set(AGE_BLOCKED_COOKIE, "1", { ...cookie, maxAge: secondsUntilEligible(dob, now) });
  } else {
    jar.set(AGE_OK_COOKIE, "1", { ...cookie, maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(back);
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
    // A custom email template appends &token_hash=… to this (README), so it
    // always carries a query string.
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/trips")}` },
  });

  if (error) {
    redirect(backTo("/sign-up", authErrorMessage(error)));
  }

  redirect("/sign-up?sent=1");
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!googleSignInEnabled()) redirect(backTo("/sign-in", copy.auth.errors.googleOff, next));
  // Google sign-in creates an account for a new address, so it passes the
  // same age screen as email sign-up.
  const age = ageStatus(await cookies());
  if (age === "blocked") redirect(backTo("/sign-in", copy.auth.errors.googleBlocked, next));
  if (age === "unknown") {
    redirect(backTo("/sign-up", copy.auth.errors.googleAgeFirst, next));
  }
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(backTo("/sign-in", copy.auth.errors.googleDown, next));
  }

  redirect(data.url);
}

/** "Forgot password?": always the same answer, whether or not the address
 *  has an account, so the form can't be used to find out who's signed up. */
export async function requestPasswordReset(formData: FormData) {
  const parsed = z.email(copy.auth.errors.badEmail).safeParse(formData.get("email"));
  if (!parsed.success) redirect(backTo("/forgot-password", parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/settings/password")}`,
  });
  // An unknown address isn't an error (Supabase answers the same either
  // way), so a real failure can be reported without revealing anything.
  if (error) {
    redirect(backTo("/forgot-password", error.status === 429 ? authErrorMessage(error) : copy.auth.errors.resetSendFailed));
  }
  redirect("/forgot-password?sent=1");
}

const newPassword = z
  .object({
    password: z.string().min(8, copy.auth.errors.shortPassword).max(72, copy.auth.errors.longPassword),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: copy.auth.errors.mismatch, path: ["confirm"] });

/** Sets a new password for the signed-in user: from Settings, or at the end
 *  of a reset link (which signs them in first, via /auth/callback). */
export async function updatePassword(formData: FormData) {
  const jar = await cookies();
  const back = (message: string) => redirect(`/settings/password?${new URLSearchParams({ error: message })}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(backTo("/sign-in", copy.auth.errors.resetExpired, "/settings/password"));
  const reset = inPasswordReset(jar.get(PASSWORD_RESET_COOKIE)?.value, user.id);

  const parsed = newPassword.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) back(parsed.error.issues[0].message);

  // Changing it from Settings asks for the current one, so a session left
  // open on a shared computer can't be used to take the account over.
  if (!reset) {
    const current = String(formData.get("current") ?? "");
    const check = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: current });
    if (check.error) back(check.error.status === 429 ? authErrorMessage(check.error) : copy.auth.errors.wrongCurrent);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data!.password });
  if (error) back(authErrorMessage(error));
  jar.delete(PASSWORD_RESET_COOKIE);
  redirect("/settings?updated=password");
}

export async function signOut() {
  (await cookies()).delete(PASSWORD_RESET_COOKIE);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Settings → Delete account. Confirmed with the password (or, for a
 *  Google-only account, the email address typed out), so a session left
 *  open on someone else's computer can't erase an account. Admins are
 *  refused, so curation is never left without one by accident. */
export async function deleteAccount(formData: FormData) {
  const t = copy.settings.deleteAccount;
  const back = (message: string) => redirect(`/settings?${new URLSearchParams({ error: message })}#delete-account`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");

  const { data: isAdmin } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (isAdmin) back(t.admin);

  if (googleOnly(user)) {
    const typed = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!typed || typed !== (user.email ?? "").toLowerCase()) back(t.emailMismatch);
  } else {
    const check = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: String(formData.get("password") ?? "") });
    if (check.error) back(check.error.status === 429 ? authErrorMessage(check.error) : copy.auth.errors.wrongCurrent);
  }

  try {
    await deleteAccountData(createAdminClient(), user.id, postHogDeleter());
  } catch (e) {
    console.error("Account deletion failed:", e instanceof Error ? e.message : e);
    back(t.failed);
  }

  // The user is gone; clear this browser's session cookies too.
  (await cookies()).delete(PASSWORD_RESET_COOKIE);
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?deleted=1");
}
