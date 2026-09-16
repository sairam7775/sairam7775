/** §11 — gaps the traveller can understand.
 *
 *  Bookings are only ever what the traveller uploads, so the detector
 *  needs no external anything: it is pure logic over their own data.
 *
 *  The rule that makes this useful is the phrasing. Not
 *  "MISSING: accommodation_booking [day_4]" but "You have nowhere to
 *  sleep on the night of 26 November. Your Kyoto hotel runs through the
 *  25th and the next booking starts on the 27th." The sentence says what
 *  is wrong, where, and what it sits between.
 *
 *  It also distinguishes never needed a booking from not booked yet. A
 *  temple with no ticket is not a gap; a teamLab slot with no ticket is. */
import type { BookingKind } from "@/lib/types";

export type GapSeverity = "blocking" | "closing" | "worth_knowing";

export interface GapAction {
  /** What the button says. */
  label: string;
  kind: "add_booking" | "ask_bento_man";
  /** Pre-fills the booking form, or seeds the message to Bento Man. */
  hint?: string;
}

export interface Gap {
  /** Stable across re-runs, so a dismissal sticks to the same gap. */
  key: string;
  severity: GapSeverity;
  /** The headline. A full sentence, no jargon. */
  title: string;
  /** What it sits between, and why it matters. */
  detail: string;
  /** The date this is about, when there is one. */
  date: string | null;
  bookingType: BookingKind | null;
  actions: GapAction[];
  /** Days until a booking window closes, for "closing". */
  daysLeft?: number;
}

export interface BookingRow {
  id: string;
  type: BookingKind;
  title: string;
  /** "YYYY-MM-DD", the local date part. */
  startsOn: string | null;
  endsOn: string | null;
  cityId: string | null;
  toCityId: string | null;
  placeId: string | null;
}

export interface GapCity {
  cityId: string;
  name: string;
  nights: number;
  sortOrder: number;
  arriveDate: string | null;
  departDate: string | null;
}

export interface GapPlace {
  placeId: string;
  name: string;
  date: string;
  /** From the verified record. */
  bookingReq: "none" | "recommended" | "required";
  bookingLeadDays: number | null;
}

export interface GapInput {
  startDate: string | null;
  endDate: string | null;
  cities: GapCity[];
  bookings: BookingRow[];
  /** Planned stops, so a ticketed place with no ticket is visible. */
  places: GapPlace[];
  /** "YYYY-MM-DD" */
  today: string;
  dismissed: Set<string>;
}

export interface NightCoverage {
  /** The night of this date: you sleep here and wake the next morning. */
  date: string;
  cityId: string | null;
  cityName: string | null;
  covered: boolean;
  bookingTitle: string | null;
}

export interface GapReport {
  nights: NightCoverage[];
  gaps: Gap[];
  /** Gaps the traveller chose to live with. Kept so they can be undone. */
  dismissed: Gap[];
  blocking: number;
  coveredNights: number;
  totalNights: number;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Every night of the trip. The last date is a departure day, not a night:
 *  you check out and leave, so it needs no bed. */
export function nightsOf(startDate: string | null, endDate: string | null): string[] {
  if (!startDate || !endDate) return [];
  const n = daysBetween(startDate, endDate);
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => addDays(startDate, i));
}

/** Where the traveller sleeps on a given night, from the accepted route. */
function cityOfNight(night: string, cities: GapCity[]): GapCity | null {
  for (const c of cities) {
    if (!c.arriveDate || !c.departDate || c.nights === 0) continue;
    if (night >= c.arriveDate && night < c.departDate) return c;
  }
  return null;
}

/** An accommodation booking covers the nights from its start up to, but
 *  not including, its end — a hotel booked 21st to 24th covers three
 *  nights and you leave on the 24th. */
function coversNight(b: BookingRow, night: string): boolean {
  if (b.type !== "accommodation" || !b.startsOn) return false;
  const end = b.endsOn ?? addDays(b.startsOn, 1);
  return night >= b.startsOn && night < end;
}

export function detectGaps(input: GapInput): GapReport {
  const { cities, bookings, places, today, dismissed } = input;
  const all: Gap[] = [];
  const nightList = nightsOf(input.startDate, input.endDate);

  // ---------------------------------------------------------- 1. a bed
  const nights: NightCoverage[] = nightList.map((date) => {
    const city = cityOfNight(date, cities);
    const booking = bookings.find((b) => coversNight(b, date));
    return {
      date,
      cityId: city?.cityId ?? null,
      cityName: city?.name ?? null,
      covered: Boolean(booking),
      bookingTitle: booking?.title ?? null,
    };
  });

  // Consecutive uncovered nights are one gap, not five. Five separate
  // sentences saying the same thing is noise.
  let run: NightCoverage[] = [];
  const flushBed = () => {
    if (!run.length) return;
    const first = run[0];
    const last = run[run.length - 1];
    const where = first.cityName ? ` in ${first.cityName}` : "";
    const before = [...bookings]
      .filter((b) => b.type === "accommodation" && b.endsOn && b.endsOn <= first.date)
      .sort((a, b) => (a.endsOn! < b.endsOn! ? 1 : -1))[0];
    const after = [...bookings]
      .filter((b) => b.type === "accommodation" && b.startsOn && b.startsOn > last.date)
      .sort((a, b) => (a.startsOn! < b.startsOn! ? -1 : 1))[0];

    const between: string[] = [];
    if (before) between.push(`${before.title} runs through the ${shortDate(addDays(before.endsOn!, -1))}`);
    if (after) between.push(`${after.title} starts on the ${shortDate(after.startsOn!)}`);

    const span = run.length === 1
      ? `the night of ${longDate(first.date)}`
      : `${run.length} nights, ${longDate(first.date)} to ${longDate(last.date)}`;

    all.push({
      key: `bed:${first.date}:${run.length}`,
      severity: "blocking",
      title: `You have nowhere to sleep on ${span}${where}.`,
      detail: between.length
        ? `${between.join(" and ")}. Nothing covers the nights in between.`
        : first.cityName
          ? `Your route has you in ${first.cityName} ${run.length === 1 ? "that night" : "those nights"}, and no accommodation is recorded.`
          : "No accommodation is recorded, and the route does not say where you are.",
      date: first.date,
      bookingType: "accommodation",
      actions: [
        { label: "Add a booking", kind: "add_booking", hint: "accommodation" },
        { label: "Ask Bento Man", kind: "ask_bento_man", hint: `Where should we stay on ${longDate(first.date)}?` },
      ],
    });
    run = [];
  };
  for (const n of nights) {
    if (n.covered) flushBed();
    else run.push(n);
  }
  flushBed();

  // ------------------------------------------------- 2. a way to get there
  const staying = cities.filter((c) => c.nights > 0).sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i + 1 < staying.length; i++) {
    const from = staying[i];
    const to = staying[i + 1];
    const when = to.arriveDate;
    const booked = bookings.some(
      (b) =>
        (b.type === "transport" || b.type === "flight") &&
        ((b.cityId === from.cityId && b.toCityId === to.cityId) ||
          (when != null && b.startsOn === when && (b.cityId === to.cityId || b.toCityId === to.cityId))),
    );
    if (booked) continue;
    all.push({
      key: `move:${from.cityId}:${to.cityId}`,
      severity: "worth_knowing",
      title: `Nothing booked for ${from.name} to ${to.name}${when ? ` on the ${shortDate(when)}` : ""}.`,
      detail:
        "Most trains on this corridor take an IC card and no reservation, so this is usually fine to leave. Book it if you have a large case, or if it is a peak week.",
      date: when,
      bookingType: "transport",
      actions: [
        { label: "Add a booking", kind: "add_booking", hint: "transport" },
        { label: "Ask Bento Man", kind: "ask_bento_man", hint: `How do we get from ${from.name} to ${to.name}?` },
      ],
    });
  }

  // ------------------------------------------- 3. tickets a place requires
  for (const p of places) {
    if (p.bookingReq === "none") continue;
    const held = bookings.some((b) => b.placeId === p.placeId || (b.startsOn === p.date && b.type === "activity"));
    if (held) continue;

    const lead = p.bookingLeadDays;
    const daysUntil = daysBetween(today, p.date);
    if (p.bookingReq === "required") {
      const closing = lead != null && daysUntil <= lead;
      all.push({
        key: `ticket:${p.placeId}:${p.date}`,
        severity: closing ? "closing" : "blocking",
        title: `${p.name} needs a ticket booked in advance, and none is recorded.`,
        detail: lead
          ? `It is on your ${longDate(p.date)}. These release about ${lead} days ahead${closing ? `, and that window is ${daysUntil <= 0 ? "gone" : `${daysUntil} days from closing`}` : ""}. The planner will leave it out of the day until a booking exists.`
          : `It is on your ${longDate(p.date)}. The planner will leave it out of the day until a booking exists.`,
        date: p.date,
        bookingType: "activity",
        actions: [
          { label: "Add a booking", kind: "add_booking", hint: "activity" },
          { label: "Ask Bento Man", kind: "ask_bento_man", hint: `Tell me about booking ${p.name}.` },
        ],
        daysLeft: lead != null ? Math.max(0, daysUntil) : undefined,
      });
      continue;
    }

    // Recommended: only worth raising while there is still time to act.
    if (lead != null && daysUntil <= lead && daysUntil >= 0) {
      all.push({
        key: `ticket-soon:${p.placeId}:${p.date}`,
        severity: "closing",
        title: `${p.name} is worth booking ahead, and the window is closing.`,
        detail: `It is on your ${longDate(p.date)}, ${daysUntil === 0 ? "today" : `${daysUntil} day${daysUntil === 1 ? "" : "s"} away`}, and it usually wants about ${lead} days' notice. Walking up often works; it is not a certainty.`,
        date: p.date,
        bookingType: "activity",
        actions: [{ label: "Add a booking", kind: "add_booking", hint: "activity" }],
        daysLeft: Math.max(0, daysUntil),
      });
    }
  }

  // --------------------------------------------------- 4. getting in and out
  if (input.startDate && !bookings.some((b) => b.type === "flight")) {
    all.push({
      key: "flight:none",
      severity: "worth_knowing",
      title: "No flights recorded.",
      detail:
        "Bento does not book flights or fetch them from anywhere. Adding them here means the arrival day is planned around the time you actually land, rather than from midnight.",
      date: input.startDate,
      bookingType: "flight",
      actions: [{ label: "Add a booking", kind: "add_booking", hint: "flight" }],
    });
  }

  const order: Record<GapSeverity, number> = { blocking: 0, closing: 1, worth_knowing: 2 };
  const live = all.filter((g) => !dismissed.has(g.key)).sort((a, b) => order[a.severity] - order[b.severity] || (a.date ?? "").localeCompare(b.date ?? ""));
  const put = all.filter((g) => dismissed.has(g.key));

  return {
    nights,
    gaps: live,
    dismissed: put,
    blocking: live.filter((g) => g.severity === "blocking").length,
    coveredNights: nights.filter((n) => n.covered).length,
    totalNights: nights.length,
  };
}
