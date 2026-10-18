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
  return {
    req: {
      session: {
        user: sessionUser,
        destroy(callback) {
          this.destroyed = true;
          delete this.user;
          callback();
        },
      },
      originalUrl: '/staff/products',
      flash(...args) {
        flashes.push(args);
      },
    },
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

function authState({ IsActive = true, RoleId = 2, RoleCode = 'SALES', permissions = [] } = {}) {
  return { IsActive, RoleId, RoleCode, permissions };
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

test('missing or inactive account destroys the old session and redirects to login', async () => {
  for (const state of [null, authState({ IsActive: false })]) {
    Account.getAuthState = async () => state;
    const { req, res, flashes } = request();
    await requireLogin(req, res, () => assert.fail('next must not run for invalid account'));

    assert.equal(req.session.destroyed, true);
    assert.equal(req.session.user, undefined);
    assert.equal(req.session.returnTo, '/staff/products');
    assert.equal(res.redirected, '/auth/login');
    assert.deepEqual(flashes, [['warning', 'Vui lòng đăng nhập để tiếp tục.']]);
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
