const test = require('node:test');
const assert = require('node:assert/strict');
const { failures } = require('../src/summary');

test('rows skipped for missing fields count as failures', () => {
  const results = [
    { status: 'sent' },
    { status: 'skipped', reason: 'Row 3 in "Push" is missing required column(s): Title' },
  ];
  assert.equal(failures(results).length, 1);
});

test('errors count as failures; sent, published and dry-run rows do not', () => {
  const results = [{ status: 'error' }, { status: 'sent' }, { status: 'published' }, { status: 'dry-run' }];
  assert.equal(failures(results).length, 1);
});
