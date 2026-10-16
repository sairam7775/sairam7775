import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { isWrongBrowser, landSignedIn, linkFailed } from "@/lib/auth-landing";

const EMAIL_TYPES: readonly EmailOtpType[] = ["recovery", "email", "signup", "magiclink", "invite", "email_change"];

/** Where every sign-in and email link lands. A `code` is PKCE (Google, and
 *  Supabase's default email links), which only works in the browser that
 *  asked for it. A `token_hash` comes from a custom email template (README)
 *  and needs nothing stored in the browser, so it works when a phone's mail
 *  app opens the link somewhere else. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return linkFailed(origin, next);
    return landSignedIn(origin, next, data.user);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return linkFailed(origin, next, isWrongBrowser(error));
    return landSignedIn(origin, next, data.user);
  }

  return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: "That link is incomplete. Try signing in again." })}`);
}
