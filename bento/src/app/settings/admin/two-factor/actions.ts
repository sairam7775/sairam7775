"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { copy } from "@/copy";
import { SETTINGS } from "../../paths";
import { afterVerifyError } from "./verify-error";

const t = copy.settings.twoFactor;

/** Where the setup is: the start button, or the QR code and key waiting for
 *  the first code. Returned to the page; nothing secret is stored by Bento. */
export type TwoFactorState =
  | { step: "start"; error?: string }
  | { step: "verify"; factorId: string; qr: string; secret: string; error?: string }
  | null;

/** Admins only; anyone else is sent back to the Settings list. */
async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${SETTINGS.admin}`);
  if (!(await isAdmin(supabase, user.id))) redirect(SETTINGS.home);
  return supabase;
}

/** Starts an authenticator-app setup with Supabase. A setup left unfinished
 *  earlier (never confirmed with a code) is removed first: its key can't be
 *  shown again, so it could never be finished. */
export async function startTwoFactorSetup(): Promise<TwoFactorState> {
  const supabase = await adminClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: t.factorName });
  if (error || !data || data.type !== "totp") {
    console.error("Starting two-factor setup failed:", error?.message ?? "no factor");
    return { step: "start", error: t.setupFailed };
  }
  return { step: "verify", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

const Code = z.object({ factorId: z.string().min(1), code: z.string().transform((s) => s.replace(/\s/g, "")).pipe(z.string().regex(/^\d{6}$/)) });

/** Checks a code: the first one confirms a new setup, later ones sign this
 *  session in with the second factor. Either way the session becomes "aal2"
 *  and the admin goes on to Admin. */
export async function verifyTwoFactor(prev: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const supabase = await adminClient();
  const keep = prev?.step === "verify" ? prev : { step: "start" as const };
  const parsed = Code.safeParse({ factorId: form.get("factorId"), code: String(form.get("code") ?? "") });
  if (!parsed.success) return { ...keep, error: t.badCode };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) {
    // Only a lookup that worked can say the setup is gone; otherwise keep it.
    const { data: factors, error: lookupError } = await supabase.auth.mfa.listFactors();
    const stillThere = Boolean(lookupError) || (factors?.all ?? []).some((f) => f.id === parsed.data.factorId);
    switch (afterVerifyError(error.code, stillThere)) {
      case "wrong":
        return { ...keep, error: t.wrongCode };
      case "restart":
        return { step: "start", error: t.setupExpired };
      case "retry":
        console.error("Checking a two-factor code failed:", error.code ?? error.message);
        return { ...keep, error: t.verifyFailed };
    }
  }
  redirect(SETTINGS.admin);
}
