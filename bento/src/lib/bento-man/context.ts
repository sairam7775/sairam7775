/** The trip as Bento Man sees it this turn. Goes in the user message, not
 *  the system prompt, so the cached prefix stays byte-stable (§09). Every
 *  number in here came from the database or the engine. */
import type { CityFacts } from "@/lib/engine/route";
import { clock } from "./diff";
import { nightsBetween, type TripState } from "./store";

export function buildContext(state: TripState, cities: CityFacts[], today: string): string {
  const { trip, prefs } = state;
  const lines: string[] = [];
  lines.push(`today: ${today}`);
  lines.push(`trip: ${trip.title ?? "untitled"} · ${trip.startDate ?? "start unset"} → ${trip.endDate ?? "end unset"}` +
    (nightsBetween(trip.startDate, trip.endDate) != null ? ` · ${nightsBetween(trip.startDate, trip.endDate)} nights` : "") +
    ` · ${trip.partySize} travelling · status ${trip.status}`);

  if (!prefs.set) {
    lines.push("preferences: not set yet (onboarding)");
  } else {
    lines.push(
      `preferences: pace ${prefs.pace} · interests ${prefs.interestTags.join(", ") || "none"} · energy ${prefs.energy} · crowd tolerance ${prefs.crowdTolerance} · discovery ${prefs.discovery}` +
        ` · never ${prefs.excludes.join(", ") || "nothing"} · mobility ${prefs.mobility.join(", ") || "none"} · dietary ${prefs.dietary.join(", ") || "none"}`,
    );
  }

  if (state.cities.length) {
    lines.push("route:");
    for (const c of state.cities) {
      lines.push(`  ${c.sortOrder + 1}. ${c.name} (${c.cityId}) · ${c.nights} night${c.nights === 1 ? "" : "s"} · tier ${c.tier}` +
        (c.arriveDate ? ` · ${c.arriveDate} → ${c.departDate}` : "") + (c.budgetBand ? ` · budget ${c.budgetBand}` : "") + (c.reason ? ` · ${c.reason}` : ""));
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
        lines.push(`    ${it.startMin != null ? clock(it.startMin) : "--:--"} ${it.name} (${it.placeId})${it.locked ? " [pinned]" : ""}${it.durationMin ? ` · ${it.durationMin} min` : ""}`);
      }
    }
  } else {
    lines.push("itinerary: no days planned yet");
  }

  if (state.pendingProposal) {
    lines.push(`pending proposal (not yet accepted): ${state.pendingProposal.summary}`);
  }

  const known = cities.filter((c) => c.tier !== "stub");
  lines.push(
    known.length
      ? `cities Bento knows: ${known.map((c) => `${c.name} (${c.id}, ${c.tier}, ${c.verifiedPlaces} verified)`).join("; ")}. Everything else is stub tier.`
      : "cities Bento knows: none above stub tier yet — say so if asked to plan days anywhere.",
  );

  return `<trip_state>\n${lines.join("\n")}\n</trip_state>`;
}
