const assert = require('node:assert/strict');
const test = require('node:test');
const stripe = require('./stripe');

const order = { OrderId: 7, TotalAmount: '25990000.00' };
const paid = { payment_status: 'paid', currency: 'vnd', amount_total: 25990000, metadata: { orderId: '7' } };

test('stripe is disabled without a valid secret key', () => {
  const old = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = '';
  assert.equal(stripe.enabled(), false);
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
  assert.equal(stripe.enabled(), true);
  process.env.STRIPE_SECRET_KEY = 'rk_test_abc';
  assert.equal(stripe.enabled(), true);
  process.env.STRIPE_SECRET_KEY = 'pk_test_abc';
  assert.equal(stripe.enabled(), false);
  process.env.STRIPE_SECRET_KEY = old;
});

test('VND is zero-decimal: amount equals the order total in dong', () => {
  assert.equal(stripe.amountOf(order), 25990000);
});

test('a session only settles an order when paid and matching order, amount and currency', () => {
  assert.equal(stripe.isPaidFor(paid, order), true);
  assert.equal(stripe.isPaidFor({ ...paid, payment_status: 'unpaid' }, order), false);
  assert.equal(stripe.isPaidFor({ ...paid, amount_total: 1000 }, order), false);
  assert.equal(stripe.isPaidFor({ ...paid, currency: 'usd' }, order), false);
  assert.equal(stripe.isPaidFor({ ...paid, metadata: { orderId: '8' } }, order), false);
  assert.equal(stripe.isPaidFor(null, order), false);
});
