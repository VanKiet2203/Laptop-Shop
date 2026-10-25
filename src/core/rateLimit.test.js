const assert = require('node:assert/strict');
const test = require('node:test');
const rateLimit = require('./rateLimit');

test.beforeEach(() => rateLimit._clear());

test('hit allows up to max within the window, then refuses with a retry-after', () => {
  for (let i = 0; i < 3; i += 1) assert.equal(rateLimit.hit('k', 3, 60000).allowed, true);
  const r = rateLimit.hit('k', 3, 60000);
  assert.equal(r.allowed, false);
  assert.ok(r.retryAfterSec >= 1 && r.retryAfterSec <= 60);
  assert.equal(rateLimit.count('k', 60000), 3);
});

test('keys are independent and reset clears a key', () => {
  rateLimit.hit('a', 1, 60000);
  assert.equal(rateLimit.hit('a', 1, 60000).allowed, false);
  assert.equal(rateLimit.hit('b', 1, 60000).allowed, true);
  rateLimit.reset('a');
  assert.equal(rateLimit.hit('a', 1, 60000).allowed, true);
});

test('old hits fall out of the sliding window', async () => {
  rateLimit.hit('w', 1, 40);
  assert.equal(rateLimit.hit('w', 1, 40).allowed, false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(rateLimit.hit('w', 1, 40).allowed, true);
});

test('failure counters can be recorded without a ceiling (Infinity)', () => {
  for (let i = 0; i < 6; i += 1) rateLimit.hit('fail', Infinity, 60000);
  assert.equal(rateLimit.count('fail', 60000), 6);
});

function http(over = {}) {
  const req = { ip: '9.9.9.9', path: '/orders/track', get: () => undefined, ...over };
  const res = {
    headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }, render(v, d) { this.rendered = { v, d }; return this; },
  };
  return { req, res };
}

test('byIp middleware: 429 page for normal requests, JSON for fetch/API requests, Retry-After set', () => {
  const mw = rateLimit.byIp('t', 1, 60000, 'chậm lại');
  let passed = 0;
  mw(http().req, http().res, () => { passed += 1; });
  assert.equal(passed, 1);

  const page = http();
  mw(page.req, page.res, () => assert.fail('must be blocked'));
  assert.equal(page.res.statusCode, 429);
  assert.equal(page.res.rendered.v, 'errors/429');
  assert.ok(page.res.headers['Retry-After']);

  const api = http({ path: '/chat/send', get: (h) => (h === 'X-Requested-With' ? 'fetch' : undefined) });
  mw(api.req, api.res, () => assert.fail('must be blocked'));
  assert.equal(api.res.statusCode, 429);
  assert.equal(api.res.body.ok, false);
});
