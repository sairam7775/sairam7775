/** Turns Supabase errors into sentences a traveller can act on. Raw messages
 *  ("duplicate key value violates…", "AuthApiError: …") never reach a page:
 *  they say nothing useful and can leak how the app is built. */

import { copy } from "@/copy";

interface AuthLikeError {
  code?: string;
  status?: number;
  message?: string;
}

const AUTH = copy.auth.supabase;

export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return copy.auth.unknownError;
  if (error.code && Object.hasOwn(AUTH, error.code)) return AUTH[error.code];
  if (error.status === 429) return AUTH.over_request_rate_limit;
  return copy.auth.serverError;
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
      return copy.db.noAccess(doing);
    case "23505":
      return copy.db.exists(doing);
    case "23514":
    case "22007":
    case "22008":
    case "22P02":
      return copy.db.invalid(doing);
    default:
      return copy.db.failed(doing);
  }
}
