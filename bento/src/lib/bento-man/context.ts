/** The trip as Bento Man sees it this turn. Goes in the user message, not
 *  the system prompt, so the cached prefix stays byte-stable (§09). Every
 *  number in here came from the database or the engine. */
import type { CityFacts } from "@/lib/engine/route";
import type { CoverageTier } from "@/lib/types";
import { copy } from "@/copy";
import { clock } from "./diff";
import { clean } from "./guard";
import { nightsBetween, type TripState } from "./store";

/** How well Bento knows a city, in the words the traveller sees on the
 *  city chips. The model is handed these, never the tier names, so what it
 *  repeats is what the page says ("main sights only", not "outline"). */
export const coverageWords = (tier: CoverageTier) => copy.coverage[tier].toLowerCase();

/** A free-text field on one line, cleaned (guard.ts), so a trip title, a
 *  saved preference or a stored summary can't add lines that look like
 *  trip state. The traveller can write any of these rows themselves. */
const field = (s: string) => clean(s).replace(/\s+/g, " ").trim();
const list = (xs: string[], none: string) => xs.map(field).join(", ") || none;

export function buildContext(state: TripState, cities: CityFacts[], today: string): string {
  const { trip, prefs } = state;
  const lines: string[] = [];
  lines.push(`today: ${today}`);
  lines.push(`trip: ${trip.title ? field(trip.title) : "untitled"} · ${trip.startDate ?? "start unset"} → ${trip.endDate ?? "end unset"}` +
    (nightsBetween(trip.startDate, trip.endDate) != null ? ` · ${nightsBetween(trip.startDate, trip.endDate)} nights` : "") +
    ` · ${trip.partySize} travelling · status ${trip.status}`);

  lines.push(prefs.autoApplyDates
    ? "date changes: apply without asking (the traveller allowed it)"
    : "date changes: proposed for the traveller to accept");

  if (!prefs.set) {
    lines.push("preferences: not set yet (onboarding)");
  } else {
    lines.push(
      `preferences: pace ${prefs.pace} · interests ${list(prefs.interestTags, "none")} · energy ${prefs.energy} · crowd tolerance ${prefs.crowdTolerance} · discovery ${prefs.discovery}` +
        ` · never ${list(prefs.excludes, "nothing")} · mobility ${list(prefs.mobility, "none")} · dietary ${list(prefs.dietary, "none")}`,
    );
  }

  if (state.cities.length) {
    lines.push("route:");
    for (const c of state.cities) {
      lines.push(`  ${c.sortOrder + 1}. ${field(c.name)} (${c.cityId}) · ${c.nights} night${c.nights === 1 ? "" : "s"} · ${coverageWords(c.tier)}` +
        (c.arriveDate ? ` · ${c.arriveDate} → ${c.departDate}` : "") + (c.budgetBand ? ` · budget ${c.budgetBand}` : "") + (c.reason ? ` · ${field(c.reason)}` : ""));
    }
  } else {
    lines.push("route: none yet");
  }

  if (state.days.length) {
    lines.push("itinerary (accepted):");
    for (const d of state.days) {
      lines.push(`  ${d.date} · ${d.cityId ?? "no city"}:`);
      if (!d.items.length) lines.push("    (empty)");
      for (const it of d.items) {
        // A free-text stop's key holds the traveller's words, so it is cleaned
        // too; a place id is unchanged by field().
        lines.push(`    ${it.startMin != null ? clock(it.startMin) : "--:--"} ${field(it.name)} (${field(it.placeId)})${it.locked ? " [pinned]" : ""}${it.durationMin ? ` · ${it.durationMin} min` : ""}`);
      }
    }
  } else {
    lines.push("itinerary: no days planned yet");
  }

  if (state.pendingProposal) {
    lines.push(`pending proposal (not yet accepted): ${field(state.pendingProposal.summary)}`);
  }

  const known = cities.filter((c) => c.tier !== "stub");
  const stubs = cities.filter((c) => c.tier === "stub");
  lines.push(
    known.length
      ? `cities Bento knows: ${known.map((c) => `${c.name} (${c.id}, ${coverageWords(c.tier)}, ${c.verifiedPlaces} verified places)`).join("; ")}.`
      : "cities Bento knows: none yet — say so if asked to plan days anywhere.",
  );
  if (stubs.length) lines.push(`${coverageWords("stub")} (name and location only; no day plans): ${stubs.map((c) => `${c.name}=${c.id}`).join(", ")}`);

  return `<trip_state>\n${lines.join("\n")}\n</trip_state>`;
}
