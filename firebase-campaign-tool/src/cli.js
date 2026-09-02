#!/usr/bin/env node
require('dotenv').config();

const { initFirebase } = require('./firebase');
const { readWorkbook, PUSH_SHEET, IAM_SHEET } = require('./excelParser');
const { sendPushNotifications } = require('./push');
const { publishInAppMessages } = require('./inAppMessage');

function parseArgs(argv) {
  const [command, filePath, ...flags] = argv;
  return {
    command,
    filePath,
    dryRun: flags.includes('--dry-run'),
    pushOnly: flags.includes('--push-only'),
    iamOnly: flags.includes('--iam-only'),
  };
}

function printResults(label, results) {
  if (!results.length) {
    console.log(`\n${label}: no rows found.`);
    return;
  }
  console.log(`\n${label}:`);
  results.forEach((r, i) => {
    if (r.status === 'sent' || r.status === 'published') {
      console.log(`  [${i + 1}] OK (${r.status})${r.messageId ? ' id=' + r.messageId : ''}${r.paramKey ? ' param=' + r.paramKey : ''}`);
    } else if (r.status === 'dry-run') {
      console.log(`  [${i + 1}] DRY-RUN — would ${r.message ? 'send' : 'publish'}: ${JSON.stringify(r.message || r.payload)}`);
    } else if (r.status === 'scheduled') {
      console.log(`  [${i + 1}] SCHEDULED — ${r.reason}`);
    } else if (r.status === 'already-sent') {
      console.log(`  [${i + 1}] ALREADY SENT — ${r.reason}`);
    } else if (r.status === 'skipped') {
      console.log(`  [${i + 1}] SKIPPED — ${r.reason}`);
    } else {
      console.log(`  [${i + 1}] ERROR — ${r.reason}`);
    }
  });
}

async function main() {
  const { command, filePath, dryRun, pushOnly, iamOnly } = parseArgs(process.argv.slice(2));

  if (command !== 'send' || !filePath) {
    console.log('Usage: node src/cli.js send <path-to-campaign.xlsx> [--dry-run] [--push-only|--iam-only]');
    process.exit(1);
  }

  const { pushRows, iamRows } = readWorkbook(filePath);
  const admin = initFirebase();

  let pushResults = [];
  let iamOutcome = { results: [] };

  if (!iamOnly) {
    pushResults = await sendPushNotifications(admin, pushRows, { dryRun });
    printResults(`Push notifications (${PUSH_SHEET})`, pushResults);
  }

  if (!pushOnly) {
    iamOutcome = await publishInAppMessages(admin, iamRows, { dryRun });
    printResults(`In-app messages (${IAM_SHEET} -> Remote Config)`, iamOutcome.results);
  }

  const allResults = [...pushResults, ...iamOutcome.results];
  const errors = allResults.filter((r) => r.status === 'error');
  if (errors.length) {
    console.log(`\n${errors.length} error(s) occurred.`);
    process.exitCode = 1;
  } else {
    console.log('\nDone.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
