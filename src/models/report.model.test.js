const assert = require('node:assert/strict');
const test = require('node:test');
const Report = require('./report.model');
const { fmtAxis, parseId, parseDateStr } = require('../core/helpers');

const NOW = new Date(2026, 9, 25, 10, 0, 0); // 25/10/2026 giờ địa phương

test('default report range is the last 30 days ending today', () => {
  assert.deepEqual(Report.normalizeRange({}, NOW), { from: '2026-09-26', to: '2026-10-25', group: 'day' });
});

test('invalid dates fall back, reversed dates are swapped, group is whitelisted, span capped at 366 days', () => {
  assert.equal(Report.normalizeRange({ from: 'abc', to: '2026-13-40' }, NOW).to, '2026-10-25');
  const swapped = Report.normalizeRange({ from: '2026-10-10', to: '2026-10-01' }, NOW);
  assert.equal(swapped.from, '2026-10-01');
  assert.equal(swapped.to, '2026-10-10');
  assert.equal(Report.normalizeRange({ group: 'year' }, NOW).group, 'day');
  assert.equal(Report.normalizeRange({ group: 'month' }, NOW).group, 'month');
  const capped = Report.normalizeRange({ from: '2000-01-01', to: '2026-10-25' }, NOW);
  assert.equal(capped.from, '2025-10-25');
});

test('product report only accepts known sort keys and limits', () => {
  assert.deepEqual(Report.normalizeProductFilters({ sort: 'x; DROP', limit: '1000', category: 'Laptop' }), { sort: 'qty', category: 'Laptop', limit: 20 });
  assert.equal(Report.normalizeProductFilters({ sort: 'profit', limit: '50' }).limit, 50);
});

test('helpers: parseId, parseDateStr and fmtAxis', () => {
  assert.equal(parseId('12'), 12);
  for (const bad of ['0', '-1', '1e3', 'abc', '', '2147483648', undefined]) assert.equal(parseId(bad), null, String(bad));
  assert.equal(parseDateStr('2026-02-28'), '2026-02-28');
  assert.equal(parseDateStr('2026-02-30'), '');
  assert.equal(parseDateStr('26-1-1'), '');
  assert.equal(fmtAxis(9856800000), '9,9 tỷ');
  assert.equal(fmtAxis(30239000), '30 tr');
  assert.equal(fmtAxis(1500000), '1,5 tr');
  assert.equal(fmtAxis(0), '0');
});
