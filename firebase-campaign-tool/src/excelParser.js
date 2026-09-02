const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const PUSH_SHEET = 'PushNotifications';
const IAM_SHEET = 'InAppMessages';

const PUSH_REQUIRED = ['EventId', 'Topic', 'Title', 'Body'];
// Body is optional for the Modal in-app message type — Firebase's own Modal
// composer only requires a title.
const IAM_REQUIRED = ['CustomId', 'Key', 'Title'];

function readWorkbook(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Excel file not found at ${resolvedPath}`);
  }

  const workbook = XLSX.readFile(resolvedPath);

  const pushSheet = workbook.Sheets[PUSH_SHEET];
  const iamSheet = workbook.Sheets[IAM_SHEET];

  if (!pushSheet && !iamSheet) {
    throw new Error(
      `Workbook must contain a "${PUSH_SHEET}" and/or "${IAM_SHEET}" sheet. ` +
        `Found sheets: ${workbook.SheetNames.join(', ')}`
    );
  }

  const pushRows = pushSheet ? XLSX.utils.sheet_to_json(pushSheet, { defval: '' }) : [];
  const iamRows = iamSheet ? XLSX.utils.sheet_to_json(iamSheet, { defval: '' }) : [];

  validateRows(pushRows, PUSH_REQUIRED, PUSH_SHEET);
  validateRows(iamRows, IAM_REQUIRED, IAM_SHEET);
  validateUnique(pushRows, 'EventId', PUSH_SHEET);
  validateUnique(iamRows, 'CustomId', IAM_SHEET);

  return { pushRows, iamRows };
}

function validateRows(rows, requiredColumns, sheetName) {
  rows.forEach((row, index) => {
    const missing = requiredColumns.filter((col) => row[col] === undefined || row[col] === '');
    if (missing.length) {
      row.__validationError = `Row ${index + 2} in "${sheetName}" is missing required column(s): ${missing.join(', ')}`;
    }
  });
}

// EventId (push) / CustomId (iam) must be unique per sheet — they're used both as
// idempotency keys (push) and as the app-facing tracking ID, so a duplicate would
// silently conflate two different notifications.
function validateUnique(rows, column, sheetName) {
  const firstSeenAtRow = new Map();
  rows.forEach((row, index) => {
    if (row.__validationError) return;
    const value = String(row[column]).trim();
    if (!value) return;
    if (firstSeenAtRow.has(value)) {
      row.__validationError = `Row ${index + 2} in "${sheetName}" has duplicate ${column} "${value}" (first used in row ${
        firstSeenAtRow.get(value) + 2
      }). Each ${column} must be unique.`;
    } else {
      firstSeenAtRow.set(value, index);
    }
  });
}

module.exports = { readWorkbook, PUSH_SHEET, IAM_SHEET };
