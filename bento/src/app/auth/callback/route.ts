import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges an OAuth or email-confirmation code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/trips";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=Sign-in link was invalid or expired.`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=Could not complete sign-in.`);
  }

  // Only ever redirect within this app — an open redirect here would be a
  // credible phishing vector off the back of a real sign-in.
  const target = next.startsWith("/") ? next : "/trips";
  return NextResponse.redirect(`${origin}${target}`);
}
