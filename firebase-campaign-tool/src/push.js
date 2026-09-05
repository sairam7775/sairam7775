const { parseDate } = require('./dates');
const { parseBool, parseIntOrUndefined } = require('./validators');
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

function buildMessage(row, eventId) {
  const {
    Topic,
    Title,
    Body,
    ImageURL,
    Data,
    Priority,
    ChannelId,
    Sound,
    ClickAction,
    CollapseKey,
    Tag,
    Badge,
    MutableContent,
    TTL,
    AnalyticsLabel,
  } = row;

  const badge = parseIntOrUndefined(Badge, 'Badge');
  const ttlSeconds = parseIntOrUndefined(TTL, 'TTL');
  const mutableContent = parseBool(MutableContent);
  const priority = Priority ? (String(Priority).toLowerCase() === 'high' ? 'high' : 'normal') : undefined;

  const androidNotification = {
    ...(ChannelId ? { channelId: String(ChannelId) } : {}),
    ...(Sound ? { sound: String(Sound) } : {}),
    ...(ClickAction ? { clickAction: String(ClickAction) } : {}),
    ...(Tag ? { tag: String(Tag) } : {}),
  };
  const android =
    priority || CollapseKey || ttlSeconds !== undefined || Object.keys(androidNotification).length
      ? {
          ...(priority ? { priority } : {}),
          ...(CollapseKey ? { collapseKey: String(CollapseKey) } : {}),
          ...(ttlSeconds !== undefined ? { ttl: ttlSeconds * 1000 } : {}),
          ...(Object.keys(androidNotification).length ? { notification: androidNotification } : {}),
        }
      : undefined;

  const aps = {
    ...(badge !== undefined ? { badge } : {}),
    ...(Sound ? { sound: String(Sound) } : {}),
    ...(mutableContent !== undefined ? { mutableContent } : {}),
  };
  const apns = Object.keys(aps).length ? { payload: { aps } } : undefined;

  const webpush = ClickAction ? { fcmOptions: { link: String(ClickAction) } } : undefined;

  const fcmOptions = AnalyticsLabel ? { analyticsLabel: String(AnalyticsLabel) } : undefined;

  return {
    topic: String(Topic).trim(),
    notification: {
      title: String(Title),
      body: String(Body),
      ...(ImageURL ? { imageUrl: String(ImageURL) } : {}),
    },
    // event_id last so a Data column can never override the tool's own tracking id.
    data: { ...(Data ? parseDataField(Data) : {}), event_id: eventId },
    ...(android ? { android } : {}),
    ...(apns ? { apns } : {}),
    ...(webpush ? { webpush } : {}),
    ...(fcmOptions ? { fcmOptions } : {}),
  };
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

    const eventId = String(row.EventId).trim();

    let sendAt;
    let message;
    try {
      sendAt = parseDate(row.SendAt, 'SendAt');
      message = buildMessage(row, eventId);
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
