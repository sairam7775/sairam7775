/** What a draft needs before anyone can sign it off. A record with no
 *  duration, no tags or no source cannot be planned with honestly, so
 *  verifying it would publish an empty promise. Shared by the one-at-a-time
 *  Verify button and the bulk page, so they never disagree. */
export interface VerifiableFields {
  duration_typical_min: number | null;
  interest_tags: string[] | null;
  sources: string[] | null;
}

export function missingForVerify(p: VerifiableFields | null | undefined): string[] {
  const missing: string[] = [];
  if (!p?.duration_typical_min) missing.push("a typical duration");
  if (!p?.interest_tags?.length) missing.push("at least one interest tag");
  if (!p?.sources?.length) missing.push("at least one source");
  return missing;
}

/** The most one bulk verify may sign at once — the whole draft set today. */
export const MAX_BULK_VERIFY = 500;
