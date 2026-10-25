const assert = require('node:assert/strict');
const test = require('node:test');
const Order = require('../../models/order.model');
const controller = require('./order.controller');

const keys = ['approve', 'cancel', 'confirmPayment', 'complete', 'confirmRefund', 'findById', 'history'];
const saved = {};
test.beforeEach(() => { for (const k of keys) saved[k] = Order[k]; });
test.afterEach(() => { for (const k of keys) Order[k] = saved[k]; });

function http({ params = {}, body = {} } = {}) {
  const flashes = [];
  const req = { params, body, query: {}, session: { user: { accountId: 7 } }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('approve calls the stored procedure with the logged-in staff account and flashes success', async () => {
  let args;
  Order.approve = async (...a) => { args = a; };
  const h = http({ params: { id: '12' } });
  await controller.approve(h.req, h.res);
  assert.deepEqual(args, [12, 7]);
  assert.equal(h.flashes[0][0], 'success');
  assert.equal(h.res.redirected, '/staff/orders/12');
});

test('a business error (THROW 50xxx) becomes a flash message, not a 500', async () => {
  Order.complete = async () => { throw Object.assign(new Error('Chỉ hoàn tất được đơn ở trạng thái Đã duyệt.'), { number: 50062 }); };
  const h = http({ params: { id: '5' } });
  await controller.complete(h.req, h.res);
  assert.deepEqual(h.flashes[0], ['danger', 'Chỉ hoàn tất được đơn ở trạng thái Đã duyệt.']);
  assert.equal(h.res.redirected, '/staff/orders/5');
});

test('a technical error is not swallowed', async () => {
  Order.confirmPayment = async () => { throw Object.assign(new Error('connection lost'), { number: 233 }); };
  await assert.rejects(controller.confirmPayment(http({ params: { id: '5' } }).req, http().res), /connection lost/);
});

test('invalid ids never reach the database', async () => {
  let called = false;
  Order.approve = async () => { called = true; };
  for (const id of ['abc', '0', '-1', '1e3', '99999999999']) {
    const h = http({ params: { id } });
    await controller.approve(h.req, h.res);
    assert.equal(h.res.redirected, '/staff/orders');
    assert.equal(h.flashes[0][0], 'danger');
  }
  assert.equal(called, false);
});

test('cancel requires a reason and trims it to the column length', async () => {
  let args;
  Order.cancel = async (...a) => { args = a; };
  const none = http({ params: { id: '3' }, body: { reason: '   ' } });
  await controller.cancel(none.req, none.res);
  assert.equal(args, undefined);
  assert.equal(none.flashes[0][0], 'danger');

  const long = http({ params: { id: '3' }, body: { reason: 'x'.repeat(400) } });
  await controller.cancel(long.req, long.res);
  assert.equal(args[0], 3);
  assert.equal(args[1].length, 255);
  assert.equal(args[2], 7);
});

test('show returns 404 for unknown or malformed ids', async () => {
  Order.findById = async () => null;
  const missing = http({ params: { id: '404' } });
  await controller.show(missing.req, missing.res);
  assert.equal(missing.res.statusCode, 404);

  const bad = http({ params: { id: 'x' } });
  await controller.show(bad.req, bad.res);
  assert.equal(bad.res.statusCode, 404);
});

test('normalizeFilters drops unknown statuses and malformed dates', () => {
  const f = Order.normalizeFilters({ status: 'Hacked', payStatus: 'Paid', from: '2026-13-99x', to: '2026-10-01', q: '  #DH1  ' });
  assert.equal(f.status, '');
  assert.equal(f.payStatus, 'Paid');
  assert.equal(f.from, '');
  assert.equal(f.to, '2026-10-01');
  assert.equal(f.q, '#DH1');
});
