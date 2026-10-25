const assert = require('node:assert/strict');
const test = require('node:test');
const Cart = require('../../models/cart.model');
const controller = require('./cart.controller');

const keys = ['assertAddable', 'itemsForEntries', 'items', 'count', 'add', 'updateQty', 'remove'];
const saved = {};
const stock = { 1: 5, 2: 0 };
const catalog = {
  1: { ProductId: 1, ProductName: 'A', Sku: 'A', Slug: 'a', SalePrice: 1000, IsActive: true, QtyAvailable: 5 },
};

test.beforeEach(() => {
  for (const k of keys) saved[k] = Cart[k];
  Cart.assertAddable = async (id) => {
    if (!(id in stock)) throw Object.assign(new Error('Sản phẩm không tồn tại hoặc đã ngừng bán.'), { number: 50090 });
    if (stock[id] <= 0) throw Object.assign(new Error('Sản phẩm này tạm hết hàng.'), { number: 50091 });
    return stock[id];
  };
  Cart.itemsForEntries = async (entries) => entries.filter((e) => catalog[e.productId]).map((e) => ({ ...catalog[e.productId], Quantity: e.qty }));
});
test.afterEach(() => { for (const k of keys) Cart[k] = saved[k]; });

function ajax(body = {}, session = {}, params = {}) {
  const req = { body, params, session: { ...session }, get: (h) => (h === 'X-Requested-With' ? 'fetch' : undefined), flash() {} };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { this.body = d; return this; }, redirect(l) { this.redirected = l; return this; }, render(v, d) { this.rendered = { v, d }; } };
  return { req, res };
}

test('a guest can add to the session cart; quantity is capped by available stock', async () => {
  const { req, res } = ajax({ productId: '1', qty: '3' });
  await controller.add(req, res);
  assert.deepEqual(res.body, { ok: true, message: 'Đã thêm vào giỏ hàng.', count: 3 });
  const again = ajax({ productId: '1', qty: '9' }, req.session);
  await controller.add(again.req, again.res);
  assert.equal(again.res.body.count, 5, 'tối đa theo tồn kho (5)');
});

test('out-of-stock, unknown and malformed products are refused with a clear message', async () => {
  for (const [id, msg] of [['2', /hết hàng/], ['999', /không tồn tại/], ['abc', /không hợp lệ/]]) {
    const { req, res } = ajax({ productId: id, qty: '1' });
    await controller.add(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.match(res.body.message, msg);
  }
});

test('update clamps to stock, returns recalculated totals, and zero removes the line', async () => {
  const session = { cart: [{ productId: 1, qty: 2 }] };
  const over = ajax({ productId: '1', qty: '50' }, session);
  await controller.update(over.req, over.res);
  assert.equal(over.res.body.qty, 5);
  assert.equal(over.res.body.clamped, true);
  assert.equal(over.res.body.lineTotal, 5000);
  assert.equal(over.res.body.subtotal, 5000);

  const zero = ajax({ productId: '1', qty: '0' }, over.req.session);
  await controller.update(zero.req, zero.res);
  assert.equal(zero.res.body.removed, true);
  assert.equal(zero.res.body.subtotal, 0);
});

test('a logged-in customer uses the DB cart model, not the session', async () => {
  const calls = [];
  Cart.add = async (cid, pid, qty) => { calls.push(['add', cid, pid, qty]); };
  Cart.count = async () => 4;
  const { req, res } = ajax({ productId: '1', qty: '2' }, { user: { customerId: 7 } });
  await controller.add(req, res);
  assert.deepEqual(calls, [['add', 7, 1, 2]]);
  assert.equal(res.body.count, 4);
  assert.equal(req.session.cart, undefined);
});

test('remove returns the new subtotal and an empty flag', async () => {
  const { req, res } = ajax({}, { cart: [{ productId: 1, qty: 1 }] }, { productId: '1' });
  await controller.remove(req, res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.empty, true);
  assert.equal(res.body.count, 0);
});
