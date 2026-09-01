function slugify(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

/**
 * Publishes in-app message content to Firebase Remote Config parameters named
 * iam_<key>. There is no public API to create real Firebase In-App Messaging
 * campaigns, so this is a documented workaround: your app must read these
 * Remote Config parameters at runtime and render its own in-app UI (see README).
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
    const { Key, Title, Body, ImageURL, CTAText, CTAUrl, Condition, Active } = row;

    if (Condition && !knownConditions.has(String(Condition).trim())) {
      results.push({
        status: 'error',
        reason: `Unknown Remote Config condition "${Condition}". Create it first in Firebase Console > Remote Config > Conditions. Known conditions: ${
          [...knownConditions].join(', ') || '(none defined)'
        }`,
        row,
      });
      continue;
    }

    const paramKey = `iam_${slugify(Key)}`;
    const payload = JSON.stringify({
      title: String(Title),
      body: String(Body),
      ...(ImageURL ? { imageUrl: String(ImageURL) } : {}),
      ...(CTAText ? { ctaText: String(CTAText) } : {}),
      ...(CTAUrl ? { ctaUrl: String(CTAUrl) } : {}),
      active: Active === undefined || Active === '' ? true : parseBool(Active),
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
