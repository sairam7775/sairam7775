import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { PASSWORD_RESET_COOKIE, PASSWORD_RESET_PATH } from "@/lib/auth-config";

/** Exchanges an OAuth or email-confirmation code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?${new URLSearchParams({ error: "That link is incomplete. Try signing in again." })}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const message = next.startsWith(PASSWORD_RESET_PATH)
      ? "That reset link has expired or was already used. Ask for a new one."
      : "That sign-in link has expired or was already used. Try signing in again.";
    const page = next.startsWith(PASSWORD_RESET_PATH) ? "/forgot-password" : "/sign-in";
    return NextResponse.redirect(`${origin}${page}?${new URLSearchParams({ error: message })}`);
  }

  // Only ever redirect within this app — an open redirect here would be a
  // credible phishing vector off the back of a real sign-in.
  const response = NextResponse.redirect(`${origin}${next}`);
  if (next.startsWith(PASSWORD_RESET_PATH) && data.user) {
    response.cookies.set(PASSWORD_RESET_COOKIE, data.user.id, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 15 * 60,
    });
  }
  else response.cookies.delete(PASSWORD_RESET_COOKIE);
  return response;
}
