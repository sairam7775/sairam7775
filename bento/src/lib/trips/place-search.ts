/** Finding one of the day's places by name, as the traveller types it.
 *  Pure, so "Add a place" filters the list it already has with no request
 *  per key. Matches the English or the Japanese name, ignoring case,
 *  accents, long vowels written as macrons, hyphens and spaces: "kiyomizu"
 *  finds Kiyomizu-dera, "todaiji" Tōdai-ji. */

/** Lower case, accents and punctuation gone, no spaces. */
export function simplifyName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** The places whose name has every word of the query in it, best first: a
 *  name that starts with the query, then one with a word that does, then
 *  the rest, each in the list's own order. Places already on the day go
 *  last. An empty query keeps the list as it is. */
export function searchPlaces<T extends { name: string; nameJa?: string | null; onDay?: boolean }>(places: T[], query: string): T[] {
  const words = query.split(/\s+/).map(simplifyName).filter(Boolean);
  if (!words.length) return [...places].sort((a, b) => Number(!!a.onDay) - Number(!!b.onDay));
  const whole = words.join("");
  const ranked: { p: T; rank: number; i: number }[] = [];
  places.forEach((p, i) => {
    const name = simplifyName(p.name);
    const ja = p.nameJa ? simplifyName(p.nameJa) : "";
    const hay = `${name} ${ja}`;
    if (!words.every((w) => hay.includes(w))) return;
    const starts = name.startsWith(whole) || ja.startsWith(whole);
    const wordStart = p.name.split(/[\s\-–&,()/]+/).some((w) => simplifyName(w).startsWith(words[0]));
    ranked.push({ p, rank: (p.onDay ? 10 : 0) + (starts ? 0 : wordStart ? 1 : 2), i });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.i - b.i).map((x) => x.p);
}
