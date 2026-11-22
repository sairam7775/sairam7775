import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

const PROTECTED = ["/trips", "/settings", "/admin"];

/** Refreshes the auth session on every request and keeps unauthenticated
 *  visitors out of the signed-in areas. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase. getSession() only reads
  // the cookie, which a client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

// Static files skip the proxy: each match is a getUser() call to Supabase.
// That covers images, the mascot animations (.json), the manifest, robots
// and sitemaps. No app route ends in one of these extensions; a new one
// that did would run without the session refresh (proxy.test.ts).
export const config = {
  matcher: ["/((?!_next/static|_next/image|ingest/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest|txt|xml)$).*)"],
};
