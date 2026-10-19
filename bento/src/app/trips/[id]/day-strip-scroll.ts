/** Centre a day chip in its own horizontal strip without moving the page. */
export function centeredDayScrollLeft({
  stripLeft,
  stripScrollLeft,
  stripClientWidth,
  stripScrollWidth,
  chipLeft,
  chipWidth,
}: {
  stripLeft: number;
  stripScrollLeft: number;
  stripClientWidth: number;
  stripScrollWidth: number;
  chipLeft: number;
  chipWidth: number;
}) {
  const chipContentLeft = chipLeft - stripLeft + stripScrollLeft;
  const centred = chipContentLeft - (stripClientWidth - chipWidth) / 2;
  return Math.max(0, Math.min(stripScrollWidth - stripClientWidth, centred));
}
