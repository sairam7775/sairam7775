export type DateRangeSummary =
  | { kind: "arrival"; date: string }
  | { kind: "departure"; date: string }
  | { kind: "range"; start: string; end: string; nights: number }
  | { kind: "endBeforeStart" };

export function summariseDateRange(start: string, end: string): DateRangeSummary | null {
  if (!start && !end) return null;
  if (start && !end) return { kind: "arrival", date: start };
  if (!start && end) return { kind: "departure", date: end };

  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (endTime < startTime) return { kind: "endBeforeStart" };

  return {
    kind: "range",
    start,
    end,
    nights: Math.round((endTime - startTime) / 86_400_000),
  };
}
