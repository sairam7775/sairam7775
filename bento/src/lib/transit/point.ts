/** PostgREST returns a geography point as hex EWKB: a byte order, the
 *  geometry type (with a flag when an SRID follows), the SRID, then
 *  longitude and latitude as doubles. Anything else reads as no location.
 *  Pure, so the engine's row reader and the graph loader share it. */
export function readPoint(value: unknown): { lat: number; lon: number } | null {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.match(/../g)!.map((pair) => parseInt(pair, 16)));
  const view = new DataView(bytes.buffer);
  if (bytes.length < 21) return null;
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  if ((type & 0xffff) !== 1) return null;
  const at = type & 0x20000000 ? 9 : 5;
  if (bytes.length < at + 16) return null;
  const lon = view.getFloat64(at, little);
  const lat = view.getFloat64(at + 8, little);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
