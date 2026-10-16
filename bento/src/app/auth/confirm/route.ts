import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { landSignedIn, linkFailed } from "@/lib/auth-landing";

const TYPES: readonly EmailOtpType[] = ["recovery", "email", "signup", "magiclink", "invite", "email_change"];

/** Verifies the token in an email link (reset password, confirm sign-up).
 *  Unlike a PKCE code, a token hash needs nothing stored in the browser, so
 *  the link works when a phone's mail app opens it somewhere else. The
 *  Supabase email templates must link here — see README. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: "That link is incomplete. Try signing in again." })}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return linkFailed(origin, next);
  return landSignedIn(origin, next, data.user);
}
