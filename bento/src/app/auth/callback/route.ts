import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { isWrongBrowser, landSignedIn, linkFailed } from "@/lib/auth-landing";

/** Exchanges an OAuth or email-confirmation code for a session. Email links
 *  normally go to /auth/confirm instead, which works in any browser. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: "That link is incomplete. Try signing in again." })}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return linkFailed(origin, next, isWrongBrowser(error));
  return landSignedIn(origin, next, data.user);
}
