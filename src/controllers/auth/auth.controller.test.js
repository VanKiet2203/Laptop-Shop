const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const mailer = require('../../core/mailer');
const rateLimit = require('../../core/rateLimit');
const controller = require('./auth.controller');

const targets = [[Account, 'findActiveByEmail'], [Account, 'countRecentResets'], [Account, 'createPasswordReset'], [Account, 'findValidReset'],
  [Account, 'completeReset'], [Account, 'findAuthInfo'], [Account, 'setPassword'], [Account, 'getPwVersion'], [Account, 'findForLogin'], [audit, 'log'], [mailer, 'sendMail']];
const saved = [];
let mails, created, setPw;
test.beforeEach(() => {
  rateLimit._clear();
  saved.length = 0; mails = []; created = []; setPw = [];
  for (const [o, k] of targets) saved.push([o, k, o[k]]);
  audit.log = async () => {};
  mailer.sendMail = async (m) => { mails.push(m); return { sent: true, mode: 'smtp' }; };
  Account.countRecentResets = async () => ({ byAccount: 0, byIp: 0 });
  Account.createPasswordReset = async (...a) => created.push(a);
  Account.setPassword = async (...a) => setPw.push(a);
  Account.getPwVersion = async () => 12345;
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http({ body = {}, params = {}, session = {} } = {}) {
  const flashes = [];
  const req = { body, params, query: {}, ip: '1.2.3.4', session: { ...session }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, set() { return this; }, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}
const ACC = { AccountId: 7, Username: 'u7', Email: 'a@b.com', FullName: 'Nguyễn A' };

test('forgot password gives the SAME reply whether or not the email exists, and only sends mail for real accounts', async () => {
  Account.findActiveByEmail = async (email) => (email === 'a@b.com' ? ACC : null);
  const hit = http({ body: { email: ' A@B.com ' } });
  await controller.forgot(hit.req, hit.res);
  const miss = http({ body: { email: 'nobody@x.com' } });
  await controller.forgot(miss.req, miss.res);
  assert.equal(hit.flashes[0][1], miss.flashes[0][1]);
  assert.equal(hit.res.redirected, '/auth/forgot');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'a@b.com');
  assert.match(mails[0].html, /\/auth\/reset\/[a-f0-9]{64}/);
});

test('only the SHA-256 of the token is stored, never the token itself', async () => {
  Account.findActiveByEmail = async () => ACC;
  await controller.forgot(http({ body: { email: 'a@b.com' } }).req, http().res);
  const token = /\/auth\/reset\/([a-f0-9]{64})/.exec(mails[0].html)[1];
  const stored = created[0][1];
  assert.notEqual(stored, token);
  assert.equal(stored, require('node:crypto').createHash('sha256').update(token).digest('hex'));
  assert.equal(created[0][2], 60);
});

test('forgot password is rate limited per session, per account and per IP, silently', async () => {
  Account.findActiveByEmail = async () => ACC;
  const fast = http({ body: { email: 'a@b.com' }, session: { lastForgot: Date.now() - 5000 } });
  await controller.forgot(fast.req, fast.res);
  assert.equal(fast.flashes[0][0], 'warning');

  for (const counts of [{ byAccount: 3, byIp: 0 }, { byAccount: 0, byIp: 10 }]) {
    Account.countRecentResets = async () => counts;
    const h = http({ body: { email: 'a@b.com' } });
    await controller.forgot(h.req, h.res);
    assert.equal(h.flashes[0][0], 'success');
  }
  assert.equal(mails.length, 0);
  assert.equal(created.length, 0);
});

test('malformed emails are ignored without touching the database', async () => {
  Account.findActiveByEmail = async () => assert.fail('must not query');
  const h = http({ body: { email: 'not an email' } });
  await controller.forgot(h.req, h.res);
  assert.equal(h.flashes[0][0], 'success');
});

test('reset page rejects malformed or unknown tokens', async () => {
  Account.findValidReset = async () => null;
  const bad = http({ params: { token: 'zzz' } });
  await controller.showReset(bad.req, bad.res);
  assert.equal(bad.res.statusCode, 400);
  assert.equal(bad.res.rendered.d.invalid, true);
  const unknown = http({ params: { token: 'a'.repeat(64) } });
  await controller.showReset(unknown.req, unknown.res);
  assert.equal(unknown.res.statusCode, 400);
});

test('reset validates the new password, then sets it once and tells the owner by email', async () => {
  const token = 'b'.repeat(64);
  Account.findValidReset = async () => ACC;
  const weak = http({ params: { token }, body: { password: '123', confirmPassword: '123' } });
  await controller.reset(weak.req, weak.res);
  assert.equal(weak.res.statusCode, 400);

  let hashed;
  Account.completeReset = async (hash, pw) => { hashed = pw; return ACC; };
  const ok = http({ params: { token }, body: { password: 'newpass1', confirmPassword: 'newpass1' } });
  await controller.reset(ok.req, ok.res);
  assert.equal(ok.res.redirected, '/auth/login');
  assert.ok(await bcrypt.compare('newpass1', hashed));
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /thay đổi/);

  Account.completeReset = async () => null; // link đã bị dùng ở lần trước
  const reused = http({ params: { token }, body: { password: 'another1', confirmPassword: 'another1' } });
  await controller.reset(reused.req, reused.res);
  assert.equal(reused.res.statusCode, 400);
  assert.equal(reused.res.rendered.d.invalid, true);
});

test('change password: wrong current password, same password and mismatch are refused; success emails the owner', async () => {
  const hash = await bcrypt.hash('current1', 4);
  Account.findAuthInfo = async () => ({ ...ACC, PasswordHash: hash });
  const session = () => ({ user: { accountId: 7, role: 'CUSTOMER' } });
  const run = async (body, s = session()) => { const h = http({ body, session: s }); await controller.changePassword(h.req, h.res); return h; };

  assert.equal((await run({ oldPassword: 'nope', password: 'brandnew1', confirmPassword: 'brandnew1' })).res.statusCode, 400);
  assert.equal((await run({ oldPassword: 'current1', password: 'current1', confirmPassword: 'current1' })).res.statusCode, 400);
  assert.equal((await run({ oldPassword: 'current1', password: 'brandnew1', confirmPassword: 'different1' })).res.statusCode, 400);
  assert.equal(setPw.length, 0);

  const ok = await run({ oldPassword: 'current1', password: 'brandnew1', confirmPassword: 'brandnew1' });
  assert.equal(ok.res.redirected, '/account');
  assert.equal(setPw.length, 1);
  assert.equal(ok.req.session.user.pwv, 12345, 'the device that changed the password stays signed in');
  assert.ok(await bcrypt.compare('brandnew1', setPw[0][1]));
  assert.equal(mails.length, 1);
});

test('too many wrong current passwords locks the form for 15 minutes', async () => {
  Account.findAuthInfo = async () => ({ ...ACC, PasswordHash: await bcrypt.hash('current1', 4) });
  const s = { user: { accountId: 7, role: 'SALES' }, pwFails: { n: 5, since: Date.now() - 1000 } };
  const h = http({ body: { oldPassword: 'current1', password: 'brandnew1', confirmPassword: 'brandnew1' }, session: s });
  await controller.changePassword(h.req, h.res);
  assert.equal(h.res.statusCode, 429);
  assert.equal(setPw.length, 0);
  assert.equal(h.res.rendered.d.layout, 'layouts/staff');
});

test('passwordError enforces length (6..72 bytes) and confirmation', () => {
  assert.match(controller.passwordError('12345', '12345'), /ít nhất 6/);
  assert.match(controller.passwordError('a'.repeat(73), 'a'.repeat(73)), /72 byte/);
  assert.match(controller.passwordError('abcdef', 'abcdeg'), /không khớp/);
  assert.equal(controller.passwordError('abcdef', 'abcdef'), null);
});

test('login: 5 wrong passwords from one IP lock that IP+account pair for 15 minutes, even for the right password', async () => {
  const hash = await bcrypt.hash('right-pass', 4);
  Account.findForLogin = async () => ({ AccountId: 7, Username: 'u7', IsActive: 1, PasswordHash: hash });
  const attempt = async (password, ip = '1.2.3.4') => { const h = http({ body: { username: 'U7', password } }); h.req.ip = ip; await controller.login(h.req, h.res); return h; };
  for (let i = 0; i < 5; i += 1) {
    const h = await attempt('wrong' + i);
    assert.match(h.flashes[0][1], /Sai tên đăng nhập/);
  }
  const locked = await attempt('right-pass');
  assert.match(locked.flashes[0][1], /quá nhiều lần/);
  assert.equal(locked.res.redirected, '/auth/login');
  // IP khác vẫn không bị khoá bởi bộ đếm của cặp (IP, tài khoản) kia
  const other = await attempt('wrong', '5.6.7.8');
  assert.match(other.flashes[0][1], /Sai tên đăng nhập/);
});

test('login: one account hammered from many IPs (20 failures) is locked for everyone; per-IP volume is capped', async () => {
  Account.findForLogin = async () => null;
  const attempt = async (name, ip) => { const h = http({ body: { username: name, password: 'x' } }); h.req.ip = ip; await controller.login(h.req, h.res); return h; };
  for (let i = 0; i < 20; i += 1) await attempt('victim', `10.0.0.${i}`);
  assert.match((await attempt('victim', '10.0.1.1')).flashes[0][1], /quá nhiều lần/);

  rateLimit._clear();
  let blocked = 0;
  for (let i = 0; i < 105; i += 1) { const h = await attempt('user' + i, '9.9.9.9'); if (/quá nhiều lần/.test(h.flashes[0][1])) blocked += 1; }
  assert.equal(blocked, 5);
});

test('the demo-accounts hint is hidden in production and when SHOW_DEMO_ACCOUNTS=false', () => {
  const run = () => { const h = http(); h.req.session = {}; controller.showLogin(h.req, h.res); return h.res.rendered.d.showDemo; };
  const env = { ...process.env };
  try {
    delete process.env.NODE_ENV; delete process.env.SHOW_DEMO_ACCOUNTS;
    assert.equal(run(), true);
    process.env.SHOW_DEMO_ACCOUNTS = 'false';
    assert.equal(run(), false);
    delete process.env.SHOW_DEMO_ACCOUNTS; process.env.NODE_ENV = 'production';
    assert.equal(run(), false);
  } finally { process.env.NODE_ENV = env.NODE_ENV; if (env.NODE_ENV === undefined) delete process.env.NODE_ENV; if (env.SHOW_DEMO_ACCOUNTS === undefined) delete process.env.SHOW_DEMO_ACCOUNTS; else process.env.SHOW_DEMO_ACCOUNTS = env.SHOW_DEMO_ACCOUNTS; }
});