/** Bento doesn't offer parental consent, so it doesn't take accounts from
 *  children: 16 and over. That is COPPA's 13 in the US, the GDPR's highest
 *  age of digital consent (16, set by several EU countries), and the age
 *  Japan's privacy guidance treats as old enough to consent alone. So sign-up
 *  starts with a neutral age screen. The privacy page and the terms say 16
 *  too (copy/en.ts); a test checks they agree.
 *
 *  Neutral means the screen asks for a date of birth and doesn't say what
 *  the cut-off is, and a refused visitor can't just go back and type a
 *  different year: the refusal is remembered in a cookie. The birth date is
 *  checked and thrown away; nothing about age is stored but that cookie. */

export const MIN_AGE = 16;

export const AGE_OK_COOKIE = "bento_age_ok";
export const AGE_BLOCKED_COOKIE = "bento_age_blocked";

/** Whole years between a "YYYY-MM-DD" birth date and `today`, or null if
 *  it isn't a real date in the past. */
export function ageOn(dob: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const born = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(born.getTime()) || born.toISOString().slice(0, 10) !== dob) return null;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  if (born.getTime() > Date.UTC(y, m, d)) return null;
  let age = y - born.getUTCFullYear();
  if (m < born.getUTCMonth() || (m === born.getUTCMonth() && d < born.getUTCDate())) age--;
  // Nobody is 130. A typo'd year is a refusal to re-enter, not an adult.
  return age > 120 ? null : age;
}

export type AgeStatus = "ok" | "blocked" | "unknown";

/** What the two cookies say. A refusal always wins over a later "ok". */
export function ageStatus(cookie: { get(name: string): { value: string } | undefined }): AgeStatus {
  if (cookie.get(AGE_BLOCKED_COOKIE)) return "blocked";
  return cookie.get(AGE_OK_COOKIE)?.value === "1" ? "ok" : "unknown";
}

/** Seconds from `now` until the visitor born on `dob` turns MIN_AGE, so a
 *  refusal expires on that birthday instead of outliving it. At least 1. */
export function secondsUntilEligible(dob: string, now: Date): number {
  const born = new Date(`${dob}T00:00:00Z`);
  const eligible = Date.UTC(born.getUTCFullYear() + MIN_AGE, born.getUTCMonth(), born.getUTCDate());
  return Math.max(1, Math.ceil((eligible - now.getTime()) / 1000));
}
