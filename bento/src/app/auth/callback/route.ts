import { createClient as createSupabaseClient, type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { holdForConfirmation, isWrongBrowser, landSignedIn, linkFailed } from "@/lib/auth-landing";
import { copy } from "@/copy";

const EMAIL_TYPES: readonly EmailOtpType[] = ["recovery", "email", "signup", "magiclink", "invite", "email_change"];

/** Checks an email link without keeping the session it returns: no cookies,
 *  so this browser isn't signed in until the visitor confirms the account. */
function linkChecker() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Where every sign-in and email link lands. A `code` is PKCE (Google, and
 *  Supabase's default email links), which only works in the browser that
 *  asked for it, so it signs straight in. A `token_hash` comes from a custom
 *  email template (README) and needs nothing stored in the browser, so it
 *  works when a phone's mail app opens the link somewhere else — and for
 *  the same reason works for anyone it's forwarded to. Its sign-in waits
 *  for the visitor to confirm the account at /auth/confirm. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { data, error } = await linkChecker().auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return linkFailed(origin, next);
    return holdForConfirmation(origin, next, data.session, data.user);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return linkFailed(origin, next, isWrongBrowser(error));
    return landSignedIn(origin, next, data.user);
  }

  return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: copy.auth.errors.linkIncomplete })}`);
}
