/** Google Maps universal links for places and stations Bento already knows. */
export interface PlaceMapInput {
  name: string;
  nameJa?: string | null;
  cityName: string;
}

export interface StationMapInput {
  name: string;
  lat?: number | null;
  lon?: number | null;
}

export function placeMapUrl({ name, nameJa, cityName }: PlaceMapInput): string {
  const query = nameJa ? `${nameJa}, ${cityName}` : `${name}, ${cityName}, Japan`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function stationQuery(station: StationMapInput): string {
  if (station.lat != null && station.lon != null) return `${station.lat},${station.lon}`;
  const name = /\bstation\b/i.test(station.name) ? station.name : `${station.name} Station`;
  return `${name}, Japan`;
}

export function journeyMapUrl({ from, to }: { from: StationMapInput; to: StationMapInput }): string {
  const origin = encodeURIComponent(stationQuery(from));
  const destination = encodeURIComponent(stationQuery(to));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`;
}
