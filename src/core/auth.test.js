const assert = require('node:assert/strict');
const test = require('node:test');
const Account = require('../models/account.model');
const db = require('../config/db');
const { requireLogin, requirePermission, requireRole } = require('./auth');

const actualGetAuthState = Account.getAuthState;
const actualQuery = db.query;

test.afterEach(() => {
  Account.getAuthState = actualGetAuthState;
  db.query = actualQuery;
});

function request(sessionUser = {
  accountId: 7,
  role: 'SALES',
  permissions: ['product.view', 'product.delete'],
}) {
  const flashes = [];
  const req = {
    originalUrl: '/staff/products',
    flash(...args) {
      flashes.push(args);
    },
  };
  // Giống express-session thật: destroy() gỡ hẳn req.session; regenerate() tạo phiên mới (rỗng) trên req
  req.session = {
    user: sessionUser,
    destroy(callback) {
      req.destroyedSession = this;
      delete req.session;
      callback();
    },
    regenerate(callback) {
      req.regeneratedFrom = this;
      req.session = { destroy: this.destroy, regenerate: this.regenerate };
      callback();
    },
  };
  return {
    req,
    res: {
      status(code) {
        this.statusCode = code;
        return this;
      },
      render(view, data) {
        this.rendered = { view, data };
        return this;
      },
      redirect(location) {
        this.redirected = location;
        return this;
      },
    },
    flashes,
  };
}

function authState({ IsActive = true, RoleId = 2, RoleCode = 'SALES', permissions = [], pwv = 0 } = {}) {
  return { IsActive, RoleId, RoleCode, permissions, pwv };
}

test('requireLogin refreshes grants and revocations when role is unchanged', async () => {
  const states = [
    authState({ permissions: ['product.view', 'product.update'] }),
    authState({ permissions: ['product.view'] }),
  ];
  Account.getAuthState = async () => states.shift();
  const { req, res } = request();
  let nextCount = 0;

  await requireLogin(req, res, () => { nextCount += 1; });
  assert.deepEqual(req.session.user.permissions, ['product.view', 'product.update']);
  assert.equal(nextCount, 1);

  await requireLogin(req, res, () => { nextCount += 1; });
  assert.deepEqual(req.session.user.permissions, ['product.view']);
  assert.equal(nextCount, 2);
});

test('requirePermission uses refreshed permissions for the current request', async () => {
  Account.getAuthState = async () => authState({ permissions: ['product.view'] });
  const { req, res } = request();
  let nextCount = 0;

  await requirePermission('product.delete')(req, res, () => { nextCount += 1; });

  assert.equal(nextCount, 0);
  assert.equal(res.statusCode, 403);
  assert.equal(res.rendered.view, 'errors/403');
  assert.deepEqual(req.session.user.permissions, ['product.view']);
});

test('requirePermission grants a newly-added permission without requiring a new login', async () => {
  Account.getAuthState = async () => authState({ permissions: ['product.view', 'product.create'] });
  const { req, res } = request();
  let nextCount = 0;

  await requirePermission('product.create')(req, res, () => { nextCount += 1; });

  assert.equal(nextCount, 1);
  assert.equal(res.statusCode, undefined);
  assert.deepEqual(req.session.user.permissions, ['product.view', 'product.create']);
});

test('role changes replace both role and permissions before downstream middleware', async () => {
  Account.getAuthState = async () => authState({
    RoleId: 4,
    RoleCode: 'WAREHOUSE',
    permissions: ['receipt.view'],
  });
  const { req, res } = request();
  let observedRole;
  let observedPermissions;

  await requireRole('WAREHOUSE')(req, res, () => {
    observedRole = req.session.user.role;
    observedPermissions = req.session.user.permissions;
  });

  assert.equal(observedRole, 'WAREHOUSE');
  assert.deepEqual(observedPermissions, ['receipt.view']);
  assert.equal(res.statusCode, undefined);
});

test('missing or inactive account is logged out with a fresh session (must not crash after the old one is gone)', async () => {
  for (const state of [null, authState({ IsActive: false })]) {
    Account.getAuthState = async () => state;
    const { req, res, flashes } = request();
    await requireLogin(req, res, () => assert.fail('next must not run for invalid account'));

    assert.ok(req.regeneratedFrom, 'old session replaced');
    assert.equal(req.session.user, undefined);
    assert.equal(req.session.returnTo, '/staff/products');
    assert.equal(res.redirected, '/auth/login');
    assert.equal(flashes.length, 1);
    assert.equal(flashes[0][0], 'warning');
  }
});

test('unauthenticated request redirects without querying account state', async () => {
  Account.getAuthState = async () => assert.fail('account lookup should not run');
  const { req, res } = request(null);
  req.session.user = null;

  await requireLogin(req, res, () => assert.fail('next must not run'));

  assert.equal(req.session.returnTo, '/staff/products');
  assert.equal(res.redirected, '/auth/login');
});

test('getAuthState returns one current role and a normalized permission list', async () => {
  Account.getAuthState = actualGetAuthState;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return [
      { IsActive: true, RoleId: 2, RoleCode: 'SALES', PermCode: 'product.create' },
      { IsActive: true, RoleId: 2, RoleCode: 'SALES', PermCode: 'product.view' },
    ];
  };

  const state = await Account.getAuthState(7);

  assert.deepEqual(state, {
    IsActive: true,
    RoleId: 2,
    RoleCode: 'SALES',
    pwv: 0,
    permissions: ['product.create', 'product.view'],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, { accountId: 7 });
  assert.match(calls[0].sql, /LEFT JOIN dbo\.RolePermissions/);
  assert.match(calls[0].sql, /LEFT JOIN dbo\.Permissions/);
  assert.match(calls[0].sql, /ORDER BY p\.PermCode/);
});

test('getAuthState returns an empty permissions list for a valid role with no grants', async () => {
  Account.getAuthState = actualGetAuthState;
  db.query = async () => [{
    IsActive: true,
    RoleId: 9,
    RoleCode: 'LIMITED',
    PermCode: null,
  }];

  assert.deepEqual(await Account.getAuthState(9), {
    IsActive: true,
    RoleId: 9,
    RoleCode: 'LIMITED',
    pwv: 0,
    permissions: [],
  });
});

test('getAuthState returns null when the account does not exist', async () => {
  Account.getAuthState = actualGetAuthState;
  db.query = async () => [];
  assert.equal(await Account.getAuthState(404), null);
});

test('database errors propagate through requireLogin error middleware', async () => {
  const databaseError = new Error('DB unavailable');
  Account.getAuthState = async () => { throw databaseError; };
  const { req, res } = request();
  let capturedError;

  await requireLogin(req, res, (error) => { capturedError = error; });

  assert.equal(capturedError, databaseError);
  assert.equal(res.redirected, undefined);
});

test('a session started before the password last changed is logged out (other devices after a password change)', async () => {
  Account.getAuthState = async () => authState({ pwv: 2000, permissions: ['product.view'] });
  const { req, res, flashes } = request({ accountId: 7, role: 'SALES', permissions: [], pwv: 1000 });
  await requireLogin(req, res, () => assert.fail('next must not run for a stale session'));
  assert.ok(req.regeneratedFrom);
  assert.equal(req.session.user, undefined);
  assert.equal(res.redirected, '/auth/login');
  assert.match(flashes[0][1], /Mật khẩu/);
});

test('a session whose password version matches keeps working; older sessions without a version adopt the current one', async () => {
  Account.getAuthState = async () => authState({ pwv: 2000, permissions: ['product.view'] });
  for (const pwv of [2000, undefined]) {
    const { req, res } = request({ accountId: 7, role: 'SALES', permissions: [], pwv });
    let ran = false;
    await requireLogin(req, res, () => { ran = true; });
    assert.equal(ran, true, `pwv=${pwv}`);
    assert.equal(req.session.user.pwv, 2000);
  }
});