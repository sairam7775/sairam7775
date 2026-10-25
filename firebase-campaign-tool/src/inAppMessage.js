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
  // This run's campaigns: which workbook key owns each parameter, and the
  // conditions its rows set, so earlier runs' targeting can be told apart.
  const owners = new Map();
  const setThisRun = new Map();

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

    const slug = slugify(Key);
    if (!slug) {
      results.push({ status: 'error', reason: `Key "${Key}" needs at least one letter or number (a–z, 0–9) to name its Remote Config parameter.`, row });
      continue;
    }
    const paramKey = `iam_${slug}`;
    const owner = String(Key).trim().toLowerCase();
    if (owners.has(paramKey) && owners.get(paramKey) !== owner) {
      results.push({
        status: 'error',
        reason: `Key "${Key}" becomes ${paramKey}, the same parameter as "${owners.get(paramKey)}" in this workbook. Give one of them a different key.`,
        row,
      });
      continue;
    }
    owners.set(paramKey, owner);
    if (!setThisRun.has(paramKey)) setThisRun.set(paramKey, new Set());

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
      const condition = String(Condition).trim();
      setThisRun.get(paramKey).add(condition);
      template.parameters[paramKey] = {
        ...existingParam,
        defaultValue: existingParam.defaultValue || { value: JSON.stringify({ active: false }) },
        conditionalValues: {
          ...(existingParam.conditionalValues || {}),
          [condition]: { value: payload },
        },
      };
    } else {
      // A row for everyone replaces the campaign: targeted values left from
      // earlier runs would otherwise still win for their audience. Targeting
      // set by this workbook's own rows stays.
      const { conditionalValues = {}, ...rest } = existingParam;
      const kept = Object.fromEntries(Object.entries(conditionalValues).filter(([name]) => setThisRun.get(paramKey).has(name)));
      template.parameters[paramKey] = {
        ...rest,
        defaultValue: { value: payload },
        ...(Object.keys(kept).length ? { conditionalValues: kept } : {}),
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
