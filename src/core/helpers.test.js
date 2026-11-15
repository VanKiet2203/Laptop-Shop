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

test('orderStage/orderSteps follow payment AND processing state per payment method', () => {
  const { orderStage, orderSteps } = require('./helpers');
  const base = { OrderNo: 'DH2611-00001', TotalAmount: 1000000, ReceiverPhone: '0912000001', CreatedAt: new Date() };
  const qrPending = { ...base, PaymentMethod: 'BankTransfer', Status: 'Pending', PaymentStatus: 'Pending' };
  assert.match(orderStage(qrPending).title, /chờ thanh toán/);
  assert.deepEqual(orderSteps(qrPending).map((s) => s.key), ['placed', 'pay', 'check', 'done']);
  assert.equal(orderSteps(qrPending).find((s) => s.current).key, 'pay');

  const qrPaid = { ...qrPending, PaymentStatus: 'Paid' };
  assert.equal(orderStage(qrPaid).title, 'Thanh toán thành công!');
  assert.equal(orderSteps(qrPaid).find((s) => s.current).key, 'check');
  assert.match(orderStage({ ...qrPaid, Status: 'Approved' }).message, /xác nhận còn hàng/);

  const cod = { ...base, PaymentMethod: 'COD', Status: 'Approved', PaymentStatus: 'Pending' };
  assert.deepEqual(orderSteps(cod).map((s) => s.key), ['placed', 'check', 'done']);
  assert.match(orderStage(cod).message, /thanh toán khi nhận hàng/);

  const inst = { ...base, PaymentMethod: 'Installment', Status: 'Approved', PaymentStatus: 'Pending' };
  assert.deepEqual(orderSteps(inst).map((s) => s.key), ['placed', 'check', 'pay', 'done']);
  assert.equal(orderStage({ ...base, PaymentMethod: 'Stripe', Status: 'Cancelled', PaymentStatus: 'Pending' }).tone, 'cancel');
});

test('orderBadge merges processing and payment state into one label', () => {
  const { orderBadge } = require('./helpers');
  const o = (PaymentMethod, Status, PaymentStatus) => orderBadge({ PaymentMethod, Status, PaymentStatus }).label;
  assert.equal(o('BankTransfer', 'Pending', 'Pending'), 'Chờ thanh toán');
  assert.equal(o('Stripe', 'Approved', 'Pending'), 'Đã xác nhận · chờ thanh toán');
  assert.equal(o('BankTransfer', 'Pending', 'Paid'), 'Đã thanh toán · đang kiểm tra hàng');
  assert.equal(o('BankTransfer', 'Approved', 'Paid'), 'Đã thanh toán · đã xác nhận');
  assert.equal(o('COD', 'Pending', 'Pending'), 'Đang kiểm tra hàng');
  assert.equal(o('COD', 'Approved', 'Pending'), 'Đã xác nhận');
  assert.equal(o('Installment', 'Approved', 'Pending'), 'Đã xác nhận · chờ thanh toán');
  assert.equal(o('Stripe', 'Cancelled', 'RefundPending'), 'Đã huỷ · chờ hoàn tiền');
  assert.equal(o('COD', 'Completed', 'Paid'), 'Đã giao');
});
