const assert = require('node:assert/strict');
const test = require('node:test');
const Account = require('../../models/account.model');
const Customer = require('../../models/customer.model');
const audit = require('../../models/audit.model');
const session = require('../../core/session');
const controller = require('./google.controller');

const envKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const savedEnv = {};
const savedFns = [];
let savedFetch;

test.beforeEach(() => {
  for (const k of envKeys) savedEnv[k] = process.env[k];
  savedFetch = global.fetch;
  savedFns.length = 0;
  for (const [o, k] of [[Account, 'findByEmail'], [Customer, 'setAvatar'], [audit, 'log']]) savedFns.push([o, k, o[k]]);
  audit.log = async () => {};
});
test.afterEach(() => {
  for (const k of envKeys) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  global.fetch = savedFetch;
  for (const [o, k, v] of savedFns) o[k] = v;
});

function http(query = {}, sess = {}) {
  const flashes = [];
  const req = { query, session: { ...sess }, flash: (...a) => flashes.push(a), ip: '::1' };
  const res = { redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('without credentials the Google button reports a clear configuration message instead of crashing', () => {
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  assert.equal(controller.isConfigured(), false);
  const { req, res, flashes } = http();
  controller.start(req, res);
  assert.equal(res.redirected, '/auth/login');
  assert.match(flashes[0][1], /chưa được cấu hình/);
});

test('start redirects to Google with a random state stored in the session', () => {
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
  const { req, res } = http();
  controller.start(req, res);
  const url = new URL(res.redirected);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'cid');
  assert.equal(url.searchParams.get('state'), req.session.googleState);
  assert.equal(req.session.googleState.length, 32);
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/auth/google/callback');
});

test('callback rejects a missing or mismatched state (CSRF) before calling Google', async () => {
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  global.fetch = async () => { throw new Error('không được gọi Google khi state sai'); };
  const bad = http({ code: 'x', state: 'wrong' }, { googleState: 'right' });
  await controller.callback(bad.req, bad.res);
  assert.equal(bad.res.redirected, '/auth/login');
  assert.match(bad.flashes[0][1], /không hợp lệ/);
  assert.equal(bad.req.session.googleState, undefined, 'state chỉ dùng một lần');
});

test('an unverified Google email cannot sign in', async () => {
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  global.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('token') ? { access_token: 't' } : { email: 'a@b.com', email_verified: false, name: 'A' }),
  });
  const { req, res, flashes } = http({ code: 'c', state: 's' }, { googleState: 's' });
  await controller.callback(req, res);
  assert.match(flashes[0][1], /chưa được xác minh/);
  assert.equal(req.session.user, undefined);
});

test('a Google email that belongs to a staff/admin account is refused (no privilege escalation by email match)', async () => {
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  global.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('token') ? { access_token: 't' } : { email: 'admin@laptopshop.vn', email_verified: true, name: 'Admin' }),
  });
  Account.findByEmail = async () => ({ AccountId: 1, IsActive: true, RoleCode: 'ADMIN' });
  const { req, res, flashes } = http({ code: 'c', state: 's' }, { googleState: 's' });
  await controller.callback(req, res);
  assert.match(flashes[0][1], /tài khoản nhân viên/);
  assert.equal(req.session.user, undefined);
  assert.equal(res.redirected, '/auth/login');
});

test('an existing customer account is linked by verified email and signed in', async () => {
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  global.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('token') ? { access_token: 't' } : { email: 'khach1@gmail.com', email_verified: true, name: 'Khách 1', picture: 'https://lh3.googleusercontent.com/a' }),
  });
  const acc = { AccountId: 5, IsActive: true, RoleCode: 'CUSTOMER', CustomerId: 7, AvatarUrl: null, Username: 'khach1', FullName: 'K' };
  Account.findByEmail = async () => acc;
  const avatars = [];
  Customer.setAvatar = async (id, url) => avatars.push([id, url]);
  const realStart = session.startSession;
  let started;
  session.startSession = async (req, a) => { started = a; req.session.user = { accountId: a.AccountId }; };
  try {
    const { req, res } = http({ code: 'c', state: 's' }, { googleState: 's' });
    await controller.callback(req, res);
    assert.equal(started.AccountId, 5);
    assert.deepEqual(avatars, [[7, 'https://lh3.googleusercontent.com/a']]);
    assert.equal(res.redirected, '/');
  } finally { session.startSession = realStart; }
});
