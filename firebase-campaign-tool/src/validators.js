function parseBool(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

function parseIntOrUndefined(value, columnName) {
  if (value === undefined || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${columnName} must be a whole number. Got: ${value}`);
  }
  return num;
}

module.exports = { parseBool, parseIntOrUndefined };
