const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const PUSH_SHEET = 'PushNotifications';
const IAM_SHEET = 'InAppMessages';

const PUSH_REQUIRED = ['Topic', 'Title', 'Body'];
const IAM_REQUIRED = ['Key', 'Title', 'Body'];

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

module.exports = { readWorkbook, PUSH_SHEET, IAM_SHEET };
