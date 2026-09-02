// Date/time columns (SendAt, StartDate, EndDate) are entered as plain ISO-8601 text
// (e.g. 2026-09-15T09:00:00Z) — the template formats those columns as Text so Excel
// doesn't silently reinterpret them as a locale-specific date serial.
function parseDate(value, columnName) {
  if (value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${columnName} must be a valid ISO date/time (e.g. 2026-09-10T09:00:00Z). Got: ${value}`);
  }
  return date;
}

module.exports = { parseDate };
