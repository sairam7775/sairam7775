/** GTFS → graph. Pure parsing, no I/O, so it is testable on a fixture and
 *  reusable by the importer script.
 *
 *  What it reads: stops.txt → stations; routes/trips/stop_times → one edge
 *  per consecutive stop pair per trip, keeping the fastest observed
 *  minutes; transfers.txt → walk edges. Fares are left null (Japanese feeds
 *  rarely carry fare_rules); the band tables cover them.
 *
 *  Known gap: services sharing a route_id but stopping differently (Local
 *  vs Rapid) collapse into one line name here. The hand seed keeps them
 *  apart; a feed-specific rule can split them by trip headsign later. */
import type { Edge, Station } from "./types";

/** RFC 4180-ish: quoted fields, doubled quotes, no embedded newlines. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function rows(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    const r: Record<string, string> = {};
    head.forEach((h, i) => (r[h] = (cells[i] ?? "").trim()));
    return r;
  });
}

const toMin = (hhmmss: string): number => {
  const [h, m, s] = hhmmss.split(":").map(Number);
  return h * 60 + m + (s ?? 0) / 60;
};

export interface GtfsFiles {
  stops: string;
  routes: string;
  trips: string;
  stop_times: string;
  transfers?: string;
}

export interface GtfsOptions {
  /** Prefix for station ids, e.g. "odpt" → "odpt:1234". */
  idPrefix?: string;
  /** Map a GTFS route to the line name used in the graph. */
  lineName?: (route: Record<string, string>) => string;
  /** Map a GTFS agency/route to a fare-band operator key. */
  operator?: (route: Record<string, string>) => string | null;
}

export function gtfsToGraph(files: GtfsFiles, opts: GtfsOptions = {}): { stations: Station[]; edges: Edge[] } {
  const pid = (id: string) => (opts.idPrefix ? `${opts.idPrefix}:${id}` : id);
  const lineName = opts.lineName ?? ((r) => r.route_short_name || r.route_long_name || r.route_id);
  const operator = opts.operator ?? ((r) => r.agency_id || null);

  const routes = new Map(rows(files.routes).map((r) => [r.route_id, r]));
  const trips = new Map(rows(files.trips).map((t) => [t.trip_id, t]));

  // Group stop_times by trip, in sequence order.
  const byTrip = new Map<string, { stop: string; dep: number; arr: number; seq: number }[]>();
  for (const st of rows(files.stop_times)) {
    const list = byTrip.get(st.trip_id) ?? byTrip.set(st.trip_id, []).get(st.trip_id)!;
    list.push({
      stop: st.stop_id,
      arr: toMin(st.arrival_time || st.departure_time),
      dep: toMin(st.departure_time || st.arrival_time),
      seq: Number(st.stop_sequence),
    });
  }

  const usedStops = new Set<string>();
  const edgeMap = new Map<string, Edge>();

  for (const [tripId, list] of byTrip) {
    const trip = trips.get(tripId);
    const routeRow = trip && routes.get(trip.route_id);
    if (!routeRow) continue;
    const line = lineName(routeRow);
    const op = operator(routeRow);
    list.sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      const minutes = Math.max(1, Math.round(b.arr - a.dep));
      usedStops.add(a.stop); usedStops.add(b.stop);
      const k = `${a.stop}>${b.stop}>${line}`;
      const existing = edgeMap.get(k);
      if (!existing || minutes < existing.minutes) {
        edgeMap.set(k, { from: pid(a.stop), to: pid(b.stop), line, mode: "rail", operator: op, minutes, stops: 1 });
      }
    }
  }

  // Which lines call at each stop, for the station record.
  const linesAt = new Map<string, Set<string>>();
  for (const e of edgeMap.values()) {
    for (const s of [e.from, e.to]) (linesAt.get(s) ?? linesAt.set(s, new Set()).get(s)!).add(e.line);
  }

  const edges = [...edgeMap.values()];

  // A stop reached only on foot is still a station — a transfer endpoint
  // must exist in the graph or the walk has nowhere to land.
  const transferRows = files.transfers ? rows(files.transfers).filter((t) => t.from_stop_id !== t.to_stop_id) : [];
  for (const t of transferRows) { usedStops.add(t.from_stop_id); usedStops.add(t.to_stop_id); }

  const stations: Station[] = rows(files.stops)
    .filter((s) => usedStops.has(s.stop_id) && (s.location_type === "" || s.location_type === "0"))
    .map((s) => ({
      id: pid(s.stop_id),
      name: s.stop_name,
      nameJa: null,
      lat: s.stop_lat ? Number(s.stop_lat) : null,
      lon: s.stop_lon ? Number(s.stop_lon) : null,
      lines: [...(linesAt.get(pid(s.stop_id)) ?? [])].sort(),
    }));

  for (const t of transferRows) {
    const minutes = Math.max(1, Math.round(Number(t.min_transfer_time || 300) / 60));
    edges.push({ from: pid(t.from_stop_id), to: pid(t.to_stop_id), line: "walk", mode: "walk", minutes });
  }

  return { stations, edges };
}
