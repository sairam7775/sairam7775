const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const PUSH_SHEET = 'PushNotifications';
const IAM_SHEET = 'InAppMessages';

const PUSH_REQUIRED = ['EventId', 'Topic', 'Title', 'Body'];
// Body is optional for the Modal in-app message type — Firebase's own Modal
// composer only requires a title.
const IAM_REQUIRED = ['CustomId', 'Key', 'Title'];

async function readWorkbook(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Excel file not found at ${resolvedPath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolvedPath);

  const pushSheet = workbook.getWorksheet(PUSH_SHEET);
  const iamSheet = workbook.getWorksheet(IAM_SHEET);

  if (!pushSheet && !iamSheet) {
    throw new Error(
      `Workbook must contain a "${PUSH_SHEET}" and/or "${IAM_SHEET}" sheet. ` +
        `Found sheets: ${workbook.worksheets.map((s) => s.name).join(', ')}`
    );
  }

  const pushRows = pushSheet ? sheetToRows(pushSheet) : [];
  const iamRows = iamSheet ? sheetToRows(iamSheet) : [];

  validateRows(pushRows, PUSH_REQUIRED, PUSH_SHEET);
  validateRows(iamRows, IAM_REQUIRED, IAM_SHEET);
  validateUnique(pushRows, 'EventId', PUSH_SHEET);
  validateUnique(iamRows, 'CustomId', IAM_SHEET);
  // Key drives the Remote Config parameter name — a duplicate silently overwrites
  // an earlier row's published content, so it must be unique just like CustomId.
  validateUnique(iamRows, 'Key', IAM_SHEET);

  return { pushRows, iamRows };
}

function cellToValue(cell) {
  let value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((rt) => rt.text).join('');
    if ('result' in value) return value.result === null || value.result === undefined ? '' : value.result;
    if ('text' in value) return value.text;
    return '';
  }
  return value;
}

function sheetToRows(sheet) {
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj = {};
    let hasAnyValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = cellToValue(row.getCell(colNumber));
      if (value !== '') hasAnyValue = true;
      obj[header] = value;
    });
    // Rows 2..500 all carry dropdown/length data-validation in the template, which
    // makes exceljs report them as existing rows even with no cell values set —
    // skip anything with no real data in any column.
    if (hasAnyValue) rows.push(obj);
  }
  return rows;
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
