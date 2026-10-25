const assert = require('node:assert/strict');
const test = require('node:test');
const guestCart = require('./guestCart');

const fakeReq = (cart) => ({ session: cart === undefined ? {} : { cart } });

test('add accumulates quantity, caps at the given stock and keeps the badge count in session', () => {
  const req = fakeReq();
  guestCart.add(req, 5, 2, 10);
  guestCart.add(req, 5, 3, 10);
  guestCart.add(req, 6, 1, 10);
  assert.deepEqual(guestCart.entries(req), [{ productId: 5, qty: 5 }, { productId: 6, qty: 1 }]);
  assert.equal(req.session.cartCount, 6);
  guestCart.add(req, 5, 50, 7);
  assert.equal(guestCart.entries(req)[0].qty, 7, 'không vượt tồn kho');
});

test('setQty and remove update or drop lines; zero or negative removes the line', () => {
  const req = fakeReq([{ productId: 1, qty: 2 }, { productId: 2, qty: 4 }]);
  guestCart.setQty(req, 1, 9);
  assert.equal(guestCart.entries(req)[0].qty, 9);
  guestCart.setQty(req, 2, 0);
  assert.deepEqual(guestCart.entries(req).map((e) => e.productId), [1]);
  guestCart.remove(req, 1);
  assert.deepEqual(guestCart.entries(req), []);
  assert.equal(req.session.cartCount, 0);
});

test('entries sanitises tampered session data (non-numeric ids, absurd quantities, too many lines)', () => {
  const dirty = [{ productId: 'abc', qty: 1 }, { productId: -4, qty: 1 }, { productId: '7', qty: 5000 }, null, { productId: 8, qty: 'x' }];
  for (let i = 100; i < 200; i += 1) dirty.push({ productId: i, qty: 1 });
  const entries = guestCart.entries(fakeReq(dirty));
  assert.equal(entries[0].productId, 7);
  assert.equal(entries[0].qty, 99);
  assert.equal(entries[1].qty, 1);
  assert.ok(entries.length <= 50);
  assert.ok(entries.every((e) => Number.isSafeInteger(e.productId) && e.productId > 0 && e.qty >= 1 && e.qty <= 99));
});

test('clear empties the cart', () => {
  const req = fakeReq([{ productId: 1, qty: 1 }]);
  guestCart.clear(req);
  assert.equal(guestCart.count(req), 0);
});
