/** Turns Supabase errors into sentences a traveller can act on. Raw messages
 *  ("duplicate key value violates…", "AuthApiError: …") never reach a page:
 *  they say nothing useful and can leak how the app is built. */

interface AuthLikeError {
  code?: string;
  status?: number;
  message?: string;
}

const AUTH: Record<string, string> = {
  user_already_exists: "There's already an account with that email. Sign in instead, or reset your password.",
  email_exists: "There's already an account with that email. Sign in instead, or reset your password.",
  weak_password: "That password is too easy to guess. Use at least 8 characters with a mix of letters and numbers.",
  same_password: "That's your current password. Choose a new one.",
  email_address_invalid: "That email address can't be used. Check it for typos.",
  email_not_confirmed: "Confirm your email first — the link is in your inbox (check spam too).",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
  signup_disabled: "New sign-ups are paused right now. Try again later.",
  session_expired: "Your session expired. Sign in again.",
  session_not_found: "Your session expired. Sign in again.",
  reauthentication_needed: "For your security, sign in again before changing your password.",
};

export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return "Something went wrong. Try again.";
  if (error.code && AUTH[error.code]) return AUTH[error.code];
  if (error.status === 429) return AUTH.over_request_rate_limit;
  return "Something went wrong on our side. Try again in a moment.";
}

interface DbLikeError {
  code?: string;
  message?: string;
}

/** `doing` finishes "Couldn't …", e.g. "save the trip". */
export function dbErrorMessage(error: DbLikeError | null | undefined, doing: string): string {
  switch (error?.code) {
    case "42501": // RLS refused the row
    case "PGRST301":
      return `Couldn't ${doing}: you don't have access to it. Sign in again if this keeps happening.`;
    case "23505":
      return `Couldn't ${doing}: it already exists.`;
    case "23514":
    case "22007":
    case "22008":
    case "22P02":
      return `Couldn't ${doing}: something in the form isn't valid. Check the dates and numbers.`;
    default:
      return `Couldn't ${doing}. Try again in a moment.`;
  }
}
