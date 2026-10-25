const assert = require('node:assert/strict');
const test = require('node:test');
const Account = require('../models/account.model');
const Cart = require('../models/cart.model');
const sessionCore = require('./session');

const keys = [[Account, 'getPermissions'], [Account, 'touchLastLogin'], [Cart, 'count'], [Cart, 'mergeEntries']];
const saved = [];
test.beforeEach(() => {
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  Account.getPermissions = async () => ['shop.buy'];
  Account.touchLastLogin = async () => {};
  Cart.count = async () => 0;
  Cart.mergeEntries = async () => {};
});
test.afterEach(() => { while (saved.length) { const [o, k, v] = saved.pop(); o[k] = v; } });

function request(session) {
  const req = { session: { ...session } };
  req.session.regenerate = function regenerate(cb) {
    req.regeneratedFrom = { ...this };
    for (const k of Object.keys(this)) if (k !== 'regenerate') delete this[k];
    cb();
  };
  return req;
}

test('login switches to a NEW session id (anti session-fixation) but keeps returnTo and the chat conversation', async () => {
  const req = request({ returnTo: '/checkout', chatConversationId: 12, somethingElse: 'dropped', cart: [{ productId: 1, qty: 1 }] });
  await sessionCore.startSession(req, { AccountId: 7, Username: 'u', FullName: 'U', RoleCode: 'CUSTOMER', RoleId: 4, CustomerId: 9 });
  assert.ok(req.regeneratedFrom, 'session.regenerate was called');
  assert.equal(req.session.returnTo, '/checkout');
  assert.equal(req.session.chatConversationId, 12);
  assert.equal(req.session.somethingElse, undefined);
  assert.equal(req.session.user.accountId, 7);
  assert.equal(req.session.user.pwv, 0);
});

test('the guest cart is merged into the customer cart before the old session is discarded', async () => {
  let merged;
  Cart.mergeEntries = async (customerId, entries) => { merged = [customerId, entries]; };
  const req = request({ cart: [{ productId: 3, qty: 2 }] });
  await sessionCore.startSession(req, { AccountId: 7, Username: 'u', FullName: 'U', RoleCode: 'CUSTOMER', RoleId: 4, CustomerId: 9 });
  assert.deepEqual(merged, [9, [{ productId: 3, qty: 2 }]]);
  assert.equal(req.session.cart, undefined);
});

test('a failed regenerate aborts the login instead of leaving a half-set session', async () => {
  const req = request({});
  req.session.regenerate = (cb) => cb(new Error('store down'));
  await assert.rejects(sessionCore.startSession(req, { AccountId: 7, RoleCode: 'SALES', RoleId: 2 }), /store down/);
  assert.equal(req.session.user, undefined);
});
