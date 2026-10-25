/** Points the AI reviewers (Codex and Gemini) disagree on, kept in
 *  `place_review_notes` (0025) for an admin to settle before verifying.
 *  Admin-only: read and settled with the service role after requireAdmin(). */

export interface ReviewerView {
  /** The value this reviewer would put in the field. */
  suggested?: unknown;
  /** True when this reviewer says the record is right as it is. With
   *  neither, the reviewer's view is only in the note. */
  keep?: boolean;
  note?: string;
  source?: string;
}

export interface ReviewNote {
  id: number;
  place_id: string;
  field: string;
  kind: "disagree" | "different_fix";
  current: unknown;
  codex: ReviewerView;
  gemini: ReviewerView;
  decision: string | null;
  settled_by: string | null;
  settled_at: string | null;
}

export const REVIEW_NOTE_COLUMNS = "id, place_id, field, kind, current, codex, gemini, decision, settled_by, settled_at";

/** The seed's field names (`seed/types.ts`) in the editor's words. */
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  lat: "Latitude",
  lon: "Longitude",
  station: "Nearest station",
  walk: "Walk from the station (min)",
  window: "Best window",
  crowdNote: "Crowd note",
  tip: "Local tip",
  cost: "Cost (¥)",
  booking: "Booking",
  lead: "Booking lead (days)",
  opens: "Opens",
  closes: "Closes",
  closedWeekdays: "Closed on",
  pairs: "Pairs with",
  conflicts: "Conflicts with",
  sources: "Sources",
};

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

/** A stored value in plain words. Seasonal hours and split prices arrive as
 *  objects ({ "March–November": "17:00", … }) and read as one line each. */
export function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "nothing (leave it empty)";
  if (typeof value === "string") return value || "nothing (leave it empty)";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.map(describeValue).join(", ") : "none";
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length ? entries.map(([k, v]) => `${k}: ${describeValue(v)}`).join(" · ") : "nothing (leave it empty)";
  }
  return String(value);
}

/** A reviewer's position in a line: the value they'd put in the field,
 *  that they'd keep it, or a pointer to their note. */
export function suggestion(view: ReviewerView): string {
  if (view && Object.hasOwn(view, "suggested")) return describeValue(view.suggested);
  return view?.keep ? "Keep what Bento has" : "See the note";
}

/** A source worth linking: an https address. Anything else (a bare domain,
 *  "own knowledge") is shown as text. */
export function sourceHref(source: string | undefined): string | null {
  if (!source) return null;
  try {
    const url = new URL(source);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
