const { parseDate } = require('./dates');
const { parseBool, parseIntOrUndefined } = require('./validators');

function slugify(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Publishes Modal-type in-app message content to Firebase Remote Config
 * parameters named iam_<key>. There is no public API to create real Firebase
 * In-App Messaging campaigns, so this is a documented workaround: your app
 * must read these Remote Config parameters at runtime and render its own
 * modal UI (see README). Only the Modal message type's fields are modeled —
 * Banner / Image only / Card are intentionally not supported.
 */
async function publishInAppMessages(admin, rows, { dryRun = false } = {}) {
  const results = [];
  const rowsToPublish = rows.filter((row) => !row.__validationError);

  rows
    .filter((row) => row.__validationError)
    .forEach((row) => results.push({ status: 'skipped', reason: row.__validationError, row }));

  if (!rowsToPublish.length) {
    return { results };
  }

  const remoteConfig = admin.remoteConfig();
  const template = await remoteConfig.getTemplate();
  const knownConditions = new Set(template.conditions.map((c) => c.name));

  for (const row of rowsToPublish) {
    const {
      CustomId,
      Key,
      Title,
      Body,
      ImageURL,
      BackgroundColor,
      TextColor,
      ButtonText,
      ButtonTextColor,
      ButtonBackgroundColor,
      ActionUrl,
      Condition,
      TriggerEvent,
      ConversionEvent,
      MaxImpressionsPerUser,
      StartDate,
      EndDate,
      Active,
    } = row;

    if (Condition && !knownConditions.has(String(Condition).trim())) {
      results.push({
        status: 'error',
        reason: `Unknown Remote Config condition "${Condition}". Create it first in Firebase Console > Remote Config > Conditions (e.g. a Country/Region condition for location targeting). Known conditions: ${
          [...knownConditions].join(', ') || '(none defined)'
        }`,
        row,
      });
      continue;
    }

    let startDate;
    let endDate;
    let maxImpressions;
    try {
      startDate = parseDate(StartDate, 'StartDate');
      endDate = parseDate(EndDate, 'EndDate');
      maxImpressions = parseIntOrUndefined(MaxImpressionsPerUser, 'MaxImpressionsPerUser');
    } catch (err) {
      results.push({ status: 'error', reason: err.message, row });
      continue;
    }

    const now = new Date();
    const withinWindow = (!startDate || startDate <= now) && (!endDate || endDate >= now);
    const requestedActive = Active === undefined || Active === '' ? true : parseBool(Active);

    const paramKey = `iam_${slugify(Key)}`;
    const payload = JSON.stringify({
      type: 'modal',
      title: String(Title),
      ...(Body ? { body: String(Body) } : {}),
      ...(ImageURL ? { imageUrl: String(ImageURL) } : {}),
      ...(BackgroundColor ? { backgroundColor: String(BackgroundColor) } : {}),
      ...(TextColor ? { textColor: String(TextColor) } : {}),
      ...(ButtonText ? { buttonText: String(ButtonText) } : {}),
      ...(ButtonTextColor ? { buttonTextColor: String(ButtonTextColor) } : {}),
      ...(ButtonBackgroundColor ? { buttonBackgroundColor: String(ButtonBackgroundColor) } : {}),
      ...(ActionUrl ? { actionUrl: String(ActionUrl) } : {}),
      customId: String(CustomId).trim(),
      triggerEvent: TriggerEvent ? String(TriggerEvent) : 'app_foreground',
      ...(ConversionEvent ? { conversionEvent: String(ConversionEvent) } : {}),
      ...(maxImpressions !== undefined ? { maxImpressionsPerUser: maxImpressions } : {}),
      ...(startDate ? { startDate: startDate.toISOString() } : {}),
      ...(endDate ? { endDate: endDate.toISOString() } : {}),
      active: requestedActive && withinWindow,
      updatedAt: new Date().toISOString(),
    });

    const existingParam = template.parameters[paramKey] || {};

    if (Condition) {
      template.parameters[paramKey] = {
        ...existingParam,
        defaultValue: existingParam.defaultValue || { value: JSON.stringify({ active: false }) },
        conditionalValues: {
          ...(existingParam.conditionalValues || {}),
          [String(Condition).trim()]: { value: payload },
        },
      };
    } else {
      template.parameters[paramKey] = {
        ...existingParam,
        defaultValue: { value: payload },
      };
    }

    results.push({ status: dryRun ? 'dry-run' : 'staged', paramKey, payload, row });
  }

  const hasStaged = results.some((r) => r.status === 'staged');
  if (!dryRun && hasStaged) {
    await remoteConfig.validateTemplate(template);
    const publishedTemplate = await remoteConfig.publishTemplate(template);
    results.forEach((r) => {
      if (r.status === 'staged') r.status = 'published';
    });
    return { results, etag: publishedTemplate.etag };
  }

  return { results };
}

module.exports = { publishInAppMessages, slugify };
