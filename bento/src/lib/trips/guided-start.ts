import { z } from "zod";
import { INTEREST_TAGS, type InterestTag, type TravelPace } from "@/lib/types";
import { copy } from "@/copy";

/** "Plan a Japan trip": the answers to a few questions, read and checked,
 *  and what they become — the trip's name, the traveller's preferences and
 *  a first message for Bento Man. Plain functions, so they can be tested;
 *  the server action (trips/actions.ts) only writes what these return. */

const t = copy.trips.guided;

export type When = "dates" | "rough" | "unsure";

export interface GuidedStart {
  when: When;
  /** "YYYY-MM", for a rough plan. */
  month: string | null;
  nights: number | null;
  startDate: string | null;
  endDate: string | null;
  people: number;
  pace: TravelPace | null;
  interests: InterestTag[];
  places: string;
  avoid: string;
}

/** Where the trip page's chat finds the first message: the tab's session
 *  storage, never the address (analytics records addresses, and nothing a
 *  traveller writes goes in one). The chat reads it once and removes it. */
export const starterKey = (tripId: string) => `bento-start:${tripId}`;

/** "November 2026", from "2026-11". */
export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(copy.locale, { month: "long", year: "numeric", timeZone: "UTC" });

/** This month and the eleven after it, for the month picker. */
export function monthOptions(today: Date, count = 12): { value: string; label: string }[] {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m + i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { value, label: monthLabel(value) };
  });
}

const text = z.string().trim().max(200).catch("");
const Answers = z.object({
  when: z.enum(["dates", "rough", "unsure"]).catch("unsure"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().catch(null),
  nights: z.coerce.number().int().min(1, t.errors.nights).max(30, t.errors.nights).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  people: z.coerce.number().int(copy.trips.errors.wholePeople).min(1, copy.trips.errors.minPeople).max(20, copy.trips.errors.maxPeople),
  pace: z.enum(["relaxed", "standard", "packed"]).nullable().catch(null),
  places: text,
  avoid: text,
});

const KNOWN_INTERESTS = new Set<string>(INTEREST_TAGS.map((i) => i.id));

/** The form's answers, checked. Missing dates under "I know my dates" count
 *  as not sure yet; a rough plan needs its month. */
export function parseGuidedStart(form: FormData): { ok: true; value: GuidedStart } | { ok: false; error: string } {
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  const parsed = Answers.safeParse({
    when: field("when"),
    month: field("month"),
    nights: field("nights"),
    startDate: field("startDate"),
    endDate: field("endDate"),
    people: field("people") ?? "1",
    pace: field("pace"),
    places: field("places") ?? "",
    avoid: field("avoid") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const a = parsed.data;
  const interests = form.getAll("interests").filter((v): v is InterestTag => typeof v === "string" && KNOWN_INTERESTS.has(v));

  let when: When = a.when;
  if (when === "dates" && (!a.startDate || !a.endDate)) when = "unsure";
  if (when === "dates" && a.endDate! < a.startDate!) return { ok: false, error: copy.trips.errors.endBeforeStart };
  if (when === "rough" && !a.month) return { ok: false, error: t.errors.month };

  return {
    ok: true,
    value: {
      when,
      month: when === "rough" ? a.month : null,
      nights: when === "rough" ? a.nights : null,
      startDate: when === "dates" ? a.startDate : null,
      endDate: when === "dates" ? a.endDate : null,
      people: a.people,
      pace: a.pace,
      interests,
      places: a.places,
      avoid: a.avoid,
    },
  };
}

/** A rough trip is named after its month; the others keep no name. */
export function guidedTitle(g: Pick<GuidedStart, "when" | "month" | "nights">): string | null {
  return g.when === "rough" && g.month ? t.roughTitle(monthLabel(g.month), g.nights) : null;
}

/** The first message for Bento Man, from the answers. Pace and interests
 *  aren't repeated: they are saved as preferences, which he already sees. */
export function starterMessage(g: Pick<GuidedStart, "when" | "month" | "nights" | "people" | "places" | "avoid">): string {
  const s = t.starter;
  const when =
    g.when === "rough" && g.month
      ? g.nights ? s.aboutNights(g.nights, monthLabel(g.month)) : s.inMonth(monthLabel(g.month))
      : g.when === "dates" ? s.dates : s.unsure;
  return [
    `${when}, ${s.people(g.people)}.`,
    g.places ? s.places(g.places) : null,
    g.avoid ? s.avoid(g.avoid) : null,
    s.ask,
  ].filter(Boolean).join(" ");
}
