const path = require('path');
const ExcelJS = require('exceljs');

// Soft, recommended character limits — not hard platform limits (which vary by OS/
// device and are governed by overall FCM payload size, not per-field). Enforced as
// Excel *warnings* (not blocks) so unusually long copy can still be entered on purpose.
const LIMITS = {
  pushTitle: 65,
  pushBody: 240,
  iamTitle: 65,
  iamBody: 300,
  ctaText: 20,
};

const DATA_ROWS = 500; // how many blank rows below the header get dropdowns/validation

function addListValidation(sheet, column, lastRow, { formulae, allowBlank = true, title, message }) {
  for (let row = 2; row <= lastRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank,
      formulae,
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: title,
      error: message,
      showInputMessage: true,
      promptTitle: title,
      prompt: message,
    };
  }
}

function addTextLengthWarning(sheet, column, lastRow, maxLen, { title, message }) {
  for (let row = 2; row <= lastRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'textLength',
      operator: 'lessThanOrEqual',
      allowBlank: true,
      formulae: [maxLen],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: title,
      error: message,
    };
  }
}

function textColumn(sheet, column, lastRow) {
  // Format as Text so Excel never silently reinterprets typed ISO datetimes as a
  // locale date serial (which would lose the intended UTC meaning).
  for (let row = 2; row <= lastRow; row++) {
    sheet.getCell(`${column}${row}`).numFmt = '@';
  }
}

async function build() {
  const workbook = new ExcelJS.Workbook();

  // ---- Instructions ----
  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [{ width: 100 }];
  const lines = [
    'Firebase Campaign Tool — Excel workbook',
    '',
    'Sheets:',
    '  - PushNotifications: one row per FCM push notification.',
    '  - InAppMessages: one row per in-app message (published to Remote Config — see README).',
    '  - Lists: dropdown source values used by the two sheets above. Edit this sheet to add your',
    '    own FCM topics and Remote Config condition names (both are project-specific, so the',
    '    starter values here are placeholders only).',
    '',
    'EventId (PushNotifications) and CustomId (InAppMessages) are required and must be unique —',
    'they are used to avoid sending the same push twice on a re-run, and as your own tracking ID.',
    '',
    'SendAt / StartDate / EndDate: enter as ISO 8601 UTC text, e.g. 2026-09-15T09:00:00Z.',
    'These columns are formatted as Text on purpose — do not reformat them as a Date, or Excel',
    'may silently convert the value using your local timezone.',
    '',
    'Title/Body/CTAText have soft length limits (shown as an orange warning, not a hard block) —',
    'push notification title/body get truncated differently across devices, so keep them concise.',
    '',
    'Run: node src/cli.js send <this-file.xlsx> [--dry-run] [--push-only|--iam-only]',
  ];
  lines.forEach((line, i) => {
    instructions.getCell(`A${i + 1}`).value = line;
  });
  instructions.getCell('A1').font = { bold: true, size: 14 };

  // ---- Lists (dropdown sources) ----
  const lists = workbook.addWorksheet('Lists');
  lists.columns = [
    { header: 'Priority', key: 'priority', width: 22 },
    { header: 'Style', key: 'style', width: 22 },
    { header: 'Boolean', key: 'bool', width: 22 },
    { header: 'Topics (edit to match your app)', key: 'topics', width: 32 },
    { header: 'Conditions (must already exist in Firebase Console > Remote Config)', key: 'conditions', width: 45 },
  ];
  lists.getRow(1).font = { bold: true };

  const priorities = ['high', 'normal'];
  const styles = ['banner', 'modal', 'fullscreen'];
  const bools = ['TRUE', 'FALSE'];
  const topics = ['promo_users', 'news_users', 'all_users', 'ios_users', 'android_users'];
  const conditions = ['India Users', 'US Users', 'iOS Users', 'Android Users'];

  const maxListLen = Math.max(priorities.length, styles.length, bools.length, topics.length, conditions.length);
  for (let i = 0; i < maxListLen; i++) {
    lists.getRow(i + 2).values = [priorities[i], styles[i], bools[i], topics[i], conditions[i]];
  }

  // ---- PushNotifications ----
  const push = workbook.addWorksheet('PushNotifications');
  push.columns = [
    { header: 'EventId', key: 'EventId', width: 24 },
    { header: 'Topic', key: 'Topic', width: 18 },
    { header: 'Title', key: 'Title', width: 30 },
    { header: 'Body', key: 'Body', width: 45 },
    { header: 'ImageURL', key: 'ImageURL', width: 30 },
    { header: 'Data', key: 'Data', width: 30 },
    { header: 'Priority', key: 'Priority', width: 12 },
    { header: 'SendAt', key: 'SendAt', width: 24 },
  ];
  push.getRow(1).font = { bold: true };
  push.views = [{ state: 'frozen', ySplit: 1 }];

  push.addRow({
    EventId: 'evt-flash-sale-001',
    Topic: 'promo_users',
    Title: 'Flash Sale!',
    Body: '20% off today only.',
    ImageURL: '',
    Data: '{"deepLink":"app://promo/flash"}',
    Priority: 'high',
    SendAt: '',
  });
  push.addRow({
    EventId: 'evt-newsletter-002',
    Topic: 'news_users',
    Title: 'Your Weekly Digest Is Here',
    Body: "Catch up on this week's top stories, community highlights, and upcoming events you won't want to miss.",
    ImageURL: 'https://example.com/images/digest.png',
    Data: '',
    Priority: 'normal',
    SendAt: '2026-09-15T09:00:00Z',
  });

  addListValidation(push, 'G', DATA_ROWS, {
    formulae: [`Lists!$A$2:$A$${1 + priorities.length}`],
    title: 'Priority',
    message: 'Choose High or Normal.',
  });
  addListValidation(push, 'B', DATA_ROWS, {
    formulae: [`Lists!$D$2:$D$${1 + topics.length}`],
    allowBlank: false,
    title: 'Topic',
    message: 'Pick a topic from the Lists sheet (edit that sheet to add your own topics).',
  });
  addTextLengthWarning(push, 'C', DATA_ROWS, LIMITS.pushTitle, {
    title: 'Long title',
    message: `Titles over ${LIMITS.pushTitle} characters may be truncated on some devices.`,
  });
  addTextLengthWarning(push, 'D', DATA_ROWS, LIMITS.pushBody, {
    title: 'Long body',
    message: `Bodies over ${LIMITS.pushBody} characters may be truncated on some devices.`,
  });
  textColumn(push, 'H', DATA_ROWS);

  // ---- InAppMessages ----
  const iam = workbook.addWorksheet('InAppMessages');
  iam.columns = [
    { header: 'CustomId', key: 'CustomId', width: 24 },
    { header: 'Key', key: 'Key', width: 24 },
    { header: 'Title', key: 'Title', width: 30 },
    { header: 'Body', key: 'Body', width: 45 },
    { header: 'ImageURL', key: 'ImageURL', width: 30 },
    { header: 'CTAText', key: 'CTAText', width: 16 },
    { header: 'CTAUrl', key: 'CTAUrl', width: 30 },
    { header: 'Condition', key: 'Condition', width: 18 },
    { header: 'Style', key: 'Style', width: 14 },
    { header: 'StartDate', key: 'StartDate', width: 24 },
    { header: 'EndDate', key: 'EndDate', width: 24 },
    { header: 'Active', key: 'Active', width: 10 },
  ];
  iam.getRow(1).font = { bold: true };
  iam.views = [{ state: 'frozen', ySplit: 1 }];

  iam.addRow({
    CustomId: 'custom-mumbai-001',
    Key: 'mumbai-store-launch',
    Title: 'We just opened in Mumbai!',
    Body: 'Visit our new store and get 15% off your first purchase.',
    ImageURL: 'https://example.com/images/mumbai-launch.png',
    CTAText: 'Get Directions',
    CTAUrl: 'https://example.com/stores/mumbai',
    Condition: 'India Users',
    Style: 'modal',
    StartDate: '2026-09-10T09:00:00Z',
    EndDate: '2026-09-17T23:59:59Z',
    Active: 'TRUE',
  });
  iam.addRow({
    CustomId: 'custom-global-002',
    Key: 'app-update-banner',
    Title: 'Update Available',
    Body: 'A new version is ready with performance improvements.',
    ImageURL: '',
    CTAText: 'Update',
    CTAUrl: 'https://example.com/update',
    Condition: '',
    Style: 'banner',
    StartDate: '',
    EndDate: '',
    Active: 'TRUE',
  });

  addListValidation(iam, 'H', DATA_ROWS, {
    formulae: [`Lists!$E$2:$E$${1 + conditions.length}`],
    title: 'Condition',
    message: 'Pick a Remote Config condition that already exists in Firebase Console, or leave blank to target everyone.',
  });
  addListValidation(iam, 'I', DATA_ROWS, {
    formulae: [`Lists!$B$2:$B$${1 + styles.length}`],
    allowBlank: false,
    title: 'Style',
    message: 'Choose how your app should render this message.',
  });
  addListValidation(iam, 'L', DATA_ROWS, {
    formulae: [`Lists!$C$2:$C$${1 + bools.length}`],
    allowBlank: false,
    title: 'Active',
    message: 'TRUE or FALSE.',
  });
  addTextLengthWarning(iam, 'C', DATA_ROWS, LIMITS.iamTitle, {
    title: 'Long title',
    message: `Titles over ${LIMITS.iamTitle} characters may not fit your in-app UI.`,
  });
  addTextLengthWarning(iam, 'D', DATA_ROWS, LIMITS.iamBody, {
    title: 'Long body',
    message: `Bodies over ${LIMITS.iamBody} characters may not fit your in-app UI.`,
  });
  addTextLengthWarning(iam, 'F', DATA_ROWS, LIMITS.ctaText, {
    title: 'Long button text',
    message: `Button labels over ${LIMITS.ctaText} characters may not fit on a button.`,
  });
  textColumn(iam, 'J', DATA_ROWS);
  textColumn(iam, 'K', DATA_ROWS);

  const outPath = path.join(__dirname, 'campaign-template.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Template written to ${outPath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
