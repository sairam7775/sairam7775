const test = require('node:test');
const assert = require('node:assert/strict');
const { publishInAppMessages } = require('../src/inAppMessage');

// Remote Config as far as publishInAppMessages uses it; the template it
// publishes is the one it was handed, so the test can read it afterwards.
function fakeAdmin(template) {
  return {
    remoteConfig: () => ({
      getTemplate: async () => template,
      validateTemplate: async (t) => t,
      publishTemplate: async () => ({ etag: 'etag-1' }),
    }),
  };
}

const row = (fields) => ({ Title: 'Autumn sale', Body: '20% off', ...fields });
const value = (param) => JSON.parse(param.defaultValue.value);

test('a campaign published for everyone drops targeting left from an earlier run', async () => {
  const template = {
    conditions: [{ name: 'vip' }],
    parameters: {
      iam_sale: {
        defaultValue: { value: JSON.stringify({ active: true }) },
        conditionalValues: { vip: { value: JSON.stringify({ title: 'Old VIP offer', active: true }) } },
      },
    },
  };
  await publishInAppMessages(fakeAdmin(template), [row({ Key: 'sale', Active: 'FALSE' })]);
  assert.equal(value(template.parameters.iam_sale).active, false);
  assert.deepEqual(template.parameters.iam_sale.conditionalValues ?? {}, {});
});

test('targeting set in the same workbook stays next to the everyone value', async () => {
  const template = { conditions: [{ name: 'vip' }], parameters: {} };
  await publishInAppMessages(fakeAdmin(template), [
    row({ Key: 'sale', Condition: 'vip', Title: 'VIP sale' }),
    row({ Key: 'sale' }),
  ]);
  assert.equal(JSON.parse(template.parameters.iam_sale.conditionalValues.vip.value).title, 'VIP sale');
  assert.equal(value(template.parameters.iam_sale).title, 'Autumn sale');
});

test('two different keys that become the same parameter are refused, not overwritten', async () => {
  const template = { conditions: [], parameters: {} };
  const { results } = await publishInAppMessages(fakeAdmin(template), [
    row({ Key: 'sale-a', Title: 'First' }),
    row({ Key: 'sale_a', Title: 'Second' }),
  ]);
  assert.equal(results[0].status, 'published');
  assert.equal(results[1].status, 'error');
  assert.match(results[1].reason, /sale_a.*sale-a|sale-a.*sale_a/);
  assert.equal(value(template.parameters.iam_sale_a).title, 'First');
});

test('the same key in different case is one campaign', async () => {
  const template = { conditions: [{ name: 'vip' }], parameters: {} };
  const { results } = await publishInAppMessages(fakeAdmin(template), [
    row({ Key: 'Sale', Condition: 'vip' }),
    row({ Key: 'sale' }),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['published', 'published']);
});

test('a key with no letters or numbers is refused', async () => {
  const template = { conditions: [], parameters: {} };
  const { results } = await publishInAppMessages(fakeAdmin(template), [row({ Key: 'セール' })]);
  assert.equal(results[0].status, 'error');
  assert.equal(template.parameters.iam_, undefined);
});
