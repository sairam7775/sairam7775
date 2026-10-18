/** The admin actions' outcomes, as address parameters the Settings page
 *  turns into words (copy.settings.admin.admins.errors). A plain module: a
 *  "use server" file may only export async functions. */
export const ADMIN_ERRORS = ["badEmail", "noAccount", "already", "self", "last", "failed"] as const;
export type AdminError = (typeof ADMIN_ERRORS)[number];

export function parseAdminError(value: unknown): AdminError | null {
  return ADMIN_ERRORS.find((e) => e === value) ?? null;
}
