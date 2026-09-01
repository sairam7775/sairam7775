function parseDataField(raw) {
  if (!raw) return undefined;
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

async function sendPushNotifications(admin, rows, { dryRun = false } = {}) {
  const results = [];

  for (const row of rows) {
    if (row.__validationError) {
      results.push({ status: 'skipped', reason: row.__validationError, row });
      continue;
    }

    const { Topic, Title, Body, ImageURL, Data, Priority } = row;

    let message;
    try {
      message = {
        topic: String(Topic).trim(),
        notification: {
          title: String(Title),
          body: String(Body),
          ...(ImageURL ? { imageUrl: String(ImageURL) } : {}),
        },
        ...(Data ? { data: parseDataField(Data) } : {}),
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
      results.push({ status: 'sent', messageId, row });
    } catch (err) {
      results.push({ status: 'error', reason: err.message, row });
    }
  }

  return results;
}

module.exports = { sendPushNotifications };
