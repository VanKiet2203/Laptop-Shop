const assert = require('node:assert/strict');
const test = require('node:test');
const h = require('./helpers');

test('installmentPlan splits the remaining amount evenly and adds flat interest only when a rate is given', () => {
  const zero = h.installmentPlan(12000000, 12, 30, 0);
  assert.equal(zero.prepay, 3600000);
  assert.equal(zero.principal, 8400000);
  assert.equal(zero.interest, 0);
  assert.equal(zero.monthly, 700000);
  assert.equal(zero.totalPaid, 12000000);

  const fin = h.installmentPlan(12000000, 12, 30, 1.2);
  assert.equal(fin.interest, Math.round(8400000 * 0.012 * 12));
  assert.equal(fin.monthly, Math.round((8400000 + fin.interest) / 12));
  assert.ok(fin.totalPaid > 12000000);
});

test('installmentPlan clamps hostile inputs', () => {
  const p = h.installmentPlan('abc', 0, 500, -1);
  assert.equal(p.prepay, 0);
  assert.ok(Number.isFinite(p.monthly));
});

test('productImage prefers a real image and falls back to category artwork', () => {
  assert.equal(h.productImage('/images/products/a.jpg', 'ram'), '/images/products/a.jpg');
  assert.equal(h.productImage('/images/placeholder.svg', 'ram'), '/images/cat-ram.svg');
  assert.equal(h.productImage(null, 'chuot'), '/images/cat-mouse.svg');
  assert.equal(h.productImage(null, 'unknown'), '/images/cat-laptop.svg');
});

test('ico only accepts safe icon names and class lists', () => {
  const svg = h.ico('cart"><script>alert(1)</script>', 'x"onload="y');
  assert.ok(!svg.includes('<script'));
  assert.ok(!svg.includes('onload'.concat('="')));
  assert.match(svg, /#i-cartscriptalert1script/);
});

test('fmtMoneyShort and ORDER_STATUS use shop wording', () => {
  assert.equal(h.fmtMoneyShort(12500000), '12,5 triệu');
  assert.equal(h.fmtMoneyShort(750000), '750 nghìn');
  assert.equal(h.ORDER_STATUS.Pending.label, 'Đang kiểm tra hàng');
});
