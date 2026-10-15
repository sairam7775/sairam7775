/** Google sign-in needs a Google OAuth client and the provider switched on
 *  in Supabase. Until both are done the button would lead to a raw error
 *  page, so it stays hidden unless BENTO_GOOGLE_SIGN_IN=1. */
/** Set by /auth/callback when a password-reset link is used: proof, for a
 *  few minutes, that this session came from the emailed link — so the new
 *  password can be set without the forgotten one. It holds the recovered
 *  user's id and only counts for that user; sign-in and sign-out clear it. */
export const PASSWORD_RESET_COOKIE = "bento_pw_reset";
export const PASSWORD_RESET_PATH = "/settings/password";

export function inPasswordReset(cookieValue: string | undefined, userId: string | undefined): boolean {
  return !!cookieValue && !!userId && cookieValue === userId;
}

export function googleSignInEnabled(): boolean {
  return process.env.BENTO_GOOGLE_SIGN_IN === "1";
}
