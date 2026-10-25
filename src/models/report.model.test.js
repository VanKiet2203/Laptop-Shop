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
  assert.equal(Report.normalizeRange({ group: 'decade' }, NOW).group, 'day');
  assert.equal(Report.normalizeRange({ group: 'year' }, NOW).group, 'year');
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

test('grouping by year (idea from PR #4) allows up to 10 years of history, other groupings stay capped at 366 days', () => {
  const y = Report.normalizeRange({ from: '2018-01-01', to: '2026-10-25', group: 'year' }, NOW);
  assert.equal(y.group, 'year');
  assert.equal(y.from, '2018-01-01');
  const longDay = Report.normalizeRange({ from: '2018-01-01', to: '2026-10-25', group: 'day' }, NOW);
  assert.equal(longDay.from, '2025-10-25');
  const veryLong = Report.normalizeRange({ from: '1990-01-01', to: '2026-10-25', group: 'year' }, NOW);
  assert.equal(veryLong.from, '2016-10-18'); // 3660 ngày tính ngược từ ngày kết thúc
});

test('revenue by year fills every year in the range, even years without sales, and sums the daily rows', async () => {
  const db = require('../config/db');
  const realQuery = db.query; const realQueryOne = db.queryOne;
  db.query = async () => [
    { SaleDate: new Date('2025-03-05'), OrderCount: 2, GrossAmount: 100, DiscountAmount: 10, VatAmount: 9, Revenue: 99 },
    { SaleDate: new Date('2025-11-20'), OrderCount: 1, GrossAmount: 50, DiscountAmount: 0, VatAmount: 5, Revenue: 55 },
    { SaleDate: new Date('2026-02-01'), OrderCount: 4, GrossAmount: 400, DiscountAmount: 0, VatAmount: 40, Revenue: 440 },
  ];
  db.queryOne = async () => ({ orders: 0, revenue: 0 });
  try {
    const r = await Report.revenue({ from: '2024-01-01', to: '2026-12-31', group: 'year' });
    assert.deepEqual(r.buckets.map((b) => [b.label, b.orders, b.revenue]), [['2024', 0, 0], ['2025', 3, 154], ['2026', 4, 440]]);
    assert.equal(r.totals.revenue, 594);
  } finally { db.query = realQuery; db.queryOne = realQueryOne; }
});
