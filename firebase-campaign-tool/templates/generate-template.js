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
  buttonText: 20,
  hexColor: 7, // "#RRGGBB"
};

const DATA_ROWS = 500; // how many blank rows below the header get dropdowns/validation
const FCM_MAX_TTL_SECONDS = 2419200; // FCM's own hard cap: 4 weeks

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

function addWholeNumberValidation(sheet, column, lastRow, { min, max, title, message }) {
  for (let row = 2; row <= lastRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'whole',
      operator: 'between',
      allowBlank: true,
      formulae: [min, max],
      showErrorMessage: true,
      errorStyle: 'error',
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
    '  - PushNotifications: one row per FCM push notification. Columns cover every field',
    '    Firebase Cloud Messaging supports (core notification, Android, iOS/APNs, Web push,',
    '    and Analytics label) — fill in only the ones you need, leave the rest blank.',
    '  - InAppMessages: one row per in-app message, restricted to the Modal message type',
    "    only (Firebase's Banner / Image only / Card types are not supported here).",
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
    'Title/Body/ButtonText have soft length limits (shown as an orange warning, not a hard block).',
    'Badge/TTL/MaxImpressionsPerUser are hard-validated as whole numbers in range.',
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
    { header: 'Boolean', key: 'bool', width: 22 },
    { header: 'Topics (edit to match your app)', key: 'topics', width: 32 },
    { header: 'Conditions (must already exist in Firebase Console > Remote Config)', key: 'conditions', width: 45 },
  ];
  lists.getRow(1).font = { bold: true };

  const priorities = ['high', 'normal'];
  const bools = ['TRUE', 'FALSE'];
  const topics = ['promo_users', 'news_users', 'all_users', 'ios_users', 'android_users'];
  const conditions = ['India Users', 'US Users', 'iOS Users', 'Android Users'];

  const maxListLen = Math.max(priorities.length, bools.length, topics.length, conditions.length);
  for (let i = 0; i < maxListLen; i++) {
    lists.getRow(i + 2).values = [priorities[i], bools[i], topics[i], conditions[i]];
  }

  // ---- PushNotifications ----
  // Column order: core notification fields first, then scheduling/data, then the
  // advanced/platform-specific fields (Android, iOS/APNs, Web, Analytics) at the end.
  const push = workbook.addWorksheet('PushNotifications');
  push.columns = [
    { header: 'EventId', key: 'EventId', width: 22 }, // A
    { header: 'Topic', key: 'Topic', width: 16 }, // B
    { header: 'Title', key: 'Title', width: 28 }, // C
    { header: 'Body', key: 'Body', width: 40 }, // D
    { header: 'ImageURL', key: 'ImageURL', width: 28 }, // E
    { header: 'Data', key: 'Data', width: 26 }, // F
    { header: 'SendAt', key: 'SendAt', width: 22 }, // G
    { header: 'Priority', key: 'Priority', width: 10 }, // H  (Android)
    { header: 'ChannelId', key: 'ChannelId', width: 16 }, // I  (Android)
    { header: 'Sound', key: 'Sound', width: 14 }, // J  (Android + iOS)
    { header: 'ClickAction', key: 'ClickAction', width: 24 }, // K  (Android + Web)
    { header: 'CollapseKey', key: 'CollapseKey', width: 16 }, // L  (Android)
    { header: 'Tag', key: 'Tag', width: 14 }, // M  (Android)
    { header: 'Badge', key: 'Badge', width: 10 }, // N  (iOS)
    { header: 'MutableContent', key: 'MutableContent', width: 16 }, // O  (iOS)
    { header: 'TTL', key: 'TTL', width: 12 }, // P  (Android, seconds)
    { header: 'AnalyticsLabel', key: 'AnalyticsLabel', width: 18 }, // Q
  ];
  push.getRow(1).font = { bold: true };
  push.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  push.addRow({
    EventId: 'evt-flash-sale-001',
    Topic: 'promo_users',
    Title: 'Flash Sale!',
    Body: '20% off today only.',
    ImageURL: '',
    Data: '{"deepLink":"app://promo/flash"}',
    SendAt: '',
    Priority: 'high',
    ChannelId: 'promotions',
    Sound: 'default',
    ClickAction: 'app://promo/flash',
    CollapseKey: '',
    Tag: '',
    Badge: '',
    MutableContent: '',
    TTL: '',
    AnalyticsLabel: 'flash_sale_sep',
  });
  push.addRow({
    EventId: 'evt-newsletter-002',
    Topic: 'news_users',
    Title: 'Your Weekly Digest Is Here',
    Body: "Catch up on this week's top stories, community highlights, and upcoming events you won't want to miss.",
    ImageURL: 'https://example.com/images/digest.png',
    Data: '',
    SendAt: '2026-09-15T09:00:00Z',
    Priority: 'normal',
    ChannelId: '',
    Sound: '',
    ClickAction: '',
    CollapseKey: 'weekly_digest',
    Tag: 'weekly_digest',
    Badge: 1,
    MutableContent: 'TRUE',
    TTL: 86400,
    AnalyticsLabel: '',
  });

  addListValidation(push, 'B', DATA_ROWS, {
    formulae: [`Lists!$C$2:$C$${1 + topics.length}`],
    allowBlank: false,
    title: 'Topic',
    message: 'Pick a topic from the Lists sheet (edit that sheet to add your own topics).',
  });
  addListValidation(push, 'H', DATA_ROWS, {
    formulae: [`Lists!$A$2:$A$${1 + priorities.length}`],
    title: 'Priority',
    message: 'Choose High or Normal (Android delivery priority).',
  });
  addListValidation(push, 'O', DATA_ROWS, {
    formulae: [`Lists!$B$2:$B$${1 + bools.length}`],
    title: 'MutableContent',
    message: 'TRUE or FALSE — required on iOS if you want the image to render via a Notification Service Extension.',
  });
  addTextLengthWarning(push, 'C', DATA_ROWS, LIMITS.pushTitle, {
    title: 'Long title',
    message: `Titles over ${LIMITS.pushTitle} characters may be truncated on some devices.`,
  });
  addTextLengthWarning(push, 'D', DATA_ROWS, LIMITS.pushBody, {
    title: 'Long body',
    message: `Bodies over ${LIMITS.pushBody} characters may be truncated on some devices.`,
  });
  addWholeNumberValidation(push, 'N', DATA_ROWS, {
    min: 0,
    max: 9999,
    title: 'Badge',
    message: 'iOS badge count must be a whole number (0 or more).',
  });
  addWholeNumberValidation(push, 'P', DATA_ROWS, {
    min: 0,
    max: FCM_MAX_TTL_SECONDS,
    title: 'TTL',
    message: `Time-to-live in seconds, 0 to ${FCM_MAX_TTL_SECONDS} (FCM's 4-week maximum).`,
  });
  textColumn(push, 'G', DATA_ROWS);

  // ---- InAppMessages (Modal type only) ----
  const iam = workbook.addWorksheet('InAppMessages');
  iam.columns = [
    { header: 'CustomId', key: 'CustomId', width: 22 }, // A
    { header: 'Key', key: 'Key', width: 22 }, // B
    { header: 'Title', key: 'Title', width: 28 }, // C
    { header: 'Body', key: 'Body', width: 40 }, // D
    { header: 'ImageURL', key: 'ImageURL', width: 28 }, // E
    { header: 'BackgroundColor', key: 'BackgroundColor', width: 16 }, // F
    { header: 'TextColor', key: 'TextColor', width: 14 }, // G
    { header: 'ButtonText', key: 'ButtonText', width: 16 }, // H
    { header: 'ButtonTextColor', key: 'ButtonTextColor', width: 16 }, // I
    { header: 'ButtonBackgroundColor', key: 'ButtonBackgroundColor', width: 20 }, // J
    { header: 'ActionUrl', key: 'ActionUrl', width: 28 }, // K
    { header: 'Condition', key: 'Condition', width: 16 }, // L
    { header: 'TriggerEvent', key: 'TriggerEvent', width: 18 }, // M
    { header: 'ConversionEvent', key: 'ConversionEvent', width: 18 }, // N
    { header: 'MaxImpressionsPerUser', key: 'MaxImpressionsPerUser', width: 20 }, // O
    { header: 'StartDate', key: 'StartDate', width: 22 }, // P
    { header: 'EndDate', key: 'EndDate', width: 22 }, // Q
    { header: 'Active', key: 'Active', width: 10 }, // R
  ];
  iam.getRow(1).font = { bold: true };
  iam.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

  iam.addRow({
    CustomId: 'custom-mumbai-001',
    Key: 'mumbai-store-launch',
    Title: 'We just opened in Mumbai!',
    Body: 'Visit our new store and get 15% off your first purchase.',
    ImageURL: 'https://example.com/images/mumbai-launch.png',
    BackgroundColor: '#FFFFFF',
    TextColor: '#111111',
    ButtonText: 'Get Directions',
    ButtonTextColor: '#FFFFFF',
    ButtonBackgroundColor: '#1A73E8',
    ActionUrl: 'https://example.com/stores/mumbai',
    Condition: 'India Users',
    TriggerEvent: '',
    ConversionEvent: 'store_direction_tap',
    MaxImpressionsPerUser: 3,
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
    BackgroundColor: '#FFFFFF',
    TextColor: '#111111',
    ButtonText: 'Update',
    ButtonTextColor: '#FFFFFF',
    ButtonBackgroundColor: '#000000',
    ActionUrl: 'https://example.com/update',
    Condition: '',
    TriggerEvent: 'app_foreground',
    ConversionEvent: '',
    MaxImpressionsPerUser: '',
    StartDate: '',
    EndDate: '',
    Active: 'TRUE',
  });

  addListValidation(iam, 'L', DATA_ROWS, {
    formulae: [`Lists!$D$2:$D$${1 + conditions.length}`],
    title: 'Condition',
    message: 'Pick a Remote Config condition that already exists in Firebase Console, or leave blank to target everyone.',
  });
  addListValidation(iam, 'R', DATA_ROWS, {
    formulae: [`Lists!$B$2:$B$${1 + bools.length}`],
    allowBlank: false,
    title: 'Active',
    message: 'TRUE or FALSE.',
  });
  addTextLengthWarning(iam, 'C', DATA_ROWS, LIMITS.iamTitle, {
    title: 'Long title',
    message: `Titles over ${LIMITS.iamTitle} characters may not fit the modal.`,
  });
  addTextLengthWarning(iam, 'D', DATA_ROWS, LIMITS.iamBody, {
    title: 'Long body',
    message: `Bodies over ${LIMITS.iamBody} characters may not fit the modal.`,
  });
  addTextLengthWarning(iam, 'H', DATA_ROWS, LIMITS.buttonText, {
    title: 'Long button text',
    message: `Button labels over ${LIMITS.buttonText} characters may not fit on the button.`,
  });
  ['F', 'G', 'I', 'J'].forEach((column) =>
    addTextLengthWarning(iam, column, DATA_ROWS, LIMITS.hexColor, {
      title: 'Color format',
      message: 'Expected a hex color like #RRGGBB.',
    })
  );
  addWholeNumberValidation(iam, 'O', DATA_ROWS, {
    min: 1,
    max: 999,
    title: 'MaxImpressionsPerUser',
    message: 'Whole number, 1 or more. Leave blank for unlimited. Your app must enforce this locally — Remote Config has no built-in impression counter.',
  });
  textColumn(iam, 'P', DATA_ROWS);
  textColumn(iam, 'Q', DATA_ROWS);

  const outPath = path.join(__dirname, 'campaign-template.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log(`Template written to ${outPath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
