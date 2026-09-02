const { parseDate } = require('./dates');
const { loadState, saveState } = require('./state');

function parseDataField(raw) {
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Data column must be valid JSON (e.g. {"orderId":"123"}). Got: ${raw}`);
  }
  const stringified = {};
  for (const [key, value] of Object.entries(parsed)) {
    stringified[key] = String(value);
  }
  return stringified;
}

async function sendPushNotifications(admin, rows, { dryRun = false, statePath } = {}) {
  const results = [];
  const state = loadState(statePath);
  let stateChanged = false;

  for (const row of rows) {
    if (row.__validationError) {
      results.push({ status: 'skipped', reason: row.__validationError, row });
      continue;
    }

    const { EventId, Topic, Title, Body, ImageURL, Data, Priority, SendAt } = row;
    const eventId = String(EventId).trim();

    let sendAt;
    try {
      sendAt = parseDate(SendAt, 'SendAt');
    } catch (err) {
      results.push({ status: 'error', reason: err.message, row });
      continue;
    }

    if (state[eventId]) {
      results.push({
        status: 'already-sent',
        reason: `EventId "${eventId}" was already sent at ${state[eventId].sentAt} (messageId=${state[eventId].messageId}). Skipping to avoid duplicate.`,
        row,
      });
      continue;
    }

    if (sendAt && sendAt > new Date()) {
      results.push({
        status: 'scheduled',
        reason: `Scheduled for ${sendAt.toISOString()}, not due yet. Re-run this command after that time (e.g. via cron).`,
        row,
      });
      continue;
    }

    let message;
    try {
      message = {
        topic: String(Topic).trim(),
        notification: {
          title: String(Title),
          body: String(Body),
          ...(ImageURL ? { imageUrl: String(ImageURL) } : {}),
        },
        data: { event_id: eventId, ...(Data ? parseDataField(Data) : {}) },
        ...(Priority
          ? { android: { priority: String(Priority).toLowerCase() === 'high' ? 'high' : 'normal' } }
          : {}),
      };
    } catch (err) {
      results.push({ status: 'error', reason: err.message, row });
      continue;
    }

    if (dryRun) {
      results.push({ status: 'dry-run', message, row });
      continue;
    }

    try {
      const messageId = await admin.messaging().send(message);
      state[eventId] = { sentAt: new Date().toISOString(), messageId };
      stateChanged = true;
      results.push({ status: 'sent', messageId, row });
    } catch (err) {
      results.push({ status: 'error', reason: err.message, row });
    }
  }

  if (!dryRun && stateChanged) {
    saveState(state, statePath);
  }

  return results;
}

module.exports = { sendPushNotifications };
