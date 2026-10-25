const assert = require('node:assert/strict');
const test = require('node:test');
const originCheck = require('./originCheck');

function run(method, headers = {}, allowed = []) {
  const req = { method, originalUrl: '/x', get: (h) => headers[h] };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v) { this.view = v; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  originCheck(() => allowed)(req, res, () => { passed = true; });
  return { passed, res };
}
const origWarn = console.warn;
test.before(() => { console.warn = () => {}; });
test.after(() => { console.warn = origWarn; });

test('safe methods are never checked', () => {
  assert.equal(run('GET', { Origin: 'https://evil.example', Host: 'shop.local' }).passed, true);
});

test('same-origin POST passes (Origin or Referer)', () => {
  assert.equal(run('POST', { Origin: 'http://shop.local:3000', Host: 'shop.local:3000' }).passed, true);
  assert.equal(run('POST', { Referer: 'http://shop.local:3000/checkout', Host: 'shop.local:3000' }).passed, true);
});

test('cross-site POST is rejected with 403 (page) or JSON for fetch', () => {
  const page = run('POST', { Origin: 'https://evil.example', Host: 'shop.local:3000' });
  assert.equal(page.passed, false);
  assert.equal(page.res.statusCode, 403);
  const api = run('POST', { Referer: 'https://evil.example/form', Host: 'shop.local:3000', 'X-Requested-With': 'fetch' });
  assert.equal(api.res.statusCode, 403);
  assert.equal(api.res.body.ok, false);
});

test('Origin "null" (sandboxed/opaque origins) is rejected; requests with no Origin/Referer (scripts, curl) are allowed', () => {
  assert.equal(run('POST', { Origin: 'null', Host: 'shop.local:3000' }).passed, false);
  assert.equal(run('POST', { Host: 'shop.local:3000' }).passed, true);
});

test('hosts from APP_URL are accepted too, and look-alike hosts are not', () => {
  assert.equal(run('POST', { Origin: 'https://shop.example.com', Host: 'internal:3000' }, ['shop.example.com']).passed, true);
  assert.equal(run('POST', { Origin: 'https://shop.example.com.evil.io', Host: 'internal:3000' }, ['shop.example.com']).passed, false);
  assert.equal(run('POST', { Origin: 'https://evil.io', Host: 'shop.local:3000' }).passed, false);
});

test('PUT / PATCH / DELETE are protected like POST', () => {
  for (const m of ['PUT', 'PATCH', 'DELETE']) assert.equal(run(m, { Origin: 'https://evil.example', Host: 'shop.local' }).passed, false, m);
});
