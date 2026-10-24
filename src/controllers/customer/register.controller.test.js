const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const Customer = require('../../models/customer.model');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const registerController = require('./register.controller');
const actualCreateWithAccount = Customer.createWithAccount;
const actualLogInTransaction = audit.logInTransaction;

const validBody = {
  username: 'newcustomer',
  email: 'customer@example.com',
  fullName: 'New Customer',
  phone: '0912345678',
  password: 'secret123',
  confirmPassword: 'secret123',
};

const originals = {};
let events;

test.beforeEach(() => {
  events = [];
  for (const [object, key] of [
    [db, 'transaction'],
    [db, 'query'],
    [Customer, 'createWithAccount'],
    [Customer, 'findAccountByUsername'],
    [Customer, 'findAccountByEmail'],
    [Customer, 'findCustomerByPhone'],
    [Account, 'getPermissions'],
    [audit, 'log'],
    [audit, 'logInTransaction'],
    [bcrypt, 'hash'],
  ]) {
    const name = `${object === db ? 'db' : object === Customer ? 'Customer' : object === Account ? 'Account' : object === audit ? 'audit' : 'bcrypt'}.${key}`;
    originals[name] = { object, key, value: object[key] };
  }

  Customer.findAccountByUsername = async () => null;
  Customer.findAccountByEmail = async () => null;
  Customer.findCustomerByPhone = async () => null;
  Customer.createWithAccount = async (data, transaction) => {
    events.push(['create', transaction, data]);
    return { accountId: 101, customerId: 202, roleId: 3 };
  };
  Account.getPermissions = async (roleId, transaction) => {
    events.push(['permissions', transaction, roleId]);
    return ['catalog.view'];
  };
  audit.log = async () => {
    events.push(['non-transactional-audit']);
  };
  audit.logInTransaction = async (transaction, req, action, entity, entityId, detail) => {
    events.push(['audit', transaction, req.accountForLog, action, entity, entityId, detail]);
  };
  bcrypt.hash = async () => 'test-password-hash';
  db.transaction = async (work) => {
    const transaction = { name: 'registration-transaction' };
    events.push(['begin', transaction]);
    try {
      const result = await work(transaction);
      events.push(['commit', transaction]);
      return result;
    } catch (error) {
      events.push(['rollback', transaction, error]);
      throw error;
    }
  };
});

test.afterEach(() => {
  for (const { object, key, value } of Object.values(originals)) object[key] = value;
  for (const key of Object.keys(originals)) delete originals[key];
});

function request(body = validBody) {
  const flashes = [];
  return {
    req: {
      body,
      session: {},
      ip: '127.0.0.1',
      flash(...args) {
        flashes.push(args);
      },
    },
    res: {
      render(view, data) {
        this.rendered = { view, data };
      },
      redirect(location) {
        this.redirected = location;
      },
    },
    flashes,
  };
}

test('register commits customer rows and audit together before creating a session', async () => {
  const { req, res, flashes } = request();
  await registerController.register(req, res);

  const transaction = events[0][1];
  assert.deepEqual(events.map(([name]) => name), ['begin', 'create', 'permissions', 'audit', 'commit']);
  assert.ok(events.slice(1, 4).every((event) => event[1] === transaction));
  assert.deepEqual(events[3].slice(2), [
    { AccountId: 101 }, 'CREATE', 'Account', 101,
    'Đăng ký tài khoản khách hàng (newcustomer)',
  ]);
  assert.equal(req.session.user.accountId, 101);
  assert.equal(req.session.user.customerId, 202);
  assert.deepEqual(req.session.user.permissions, ['catalog.view']);
  assert.equal(req.session.cartCount, 0);
  assert.equal(req.accountForLog, undefined);
  assert.equal(events.some(([name]) => name === 'non-transactional-audit'), false);
  assert.deepEqual(flashes, [['success', 'Chào mừng New Customer! Tài khoản đã được tạo.']]);
  assert.equal(res.redirected, '/');
});

test('audit failure rolls back registration and does not establish a session', async () => {
  const { req, res, flashes } = request();
  const failure = Object.assign(new Error('Audit unavailable'), { code: 'AUDIT_WRITE_FAILED' });
  audit.logInTransaction = async (transaction) => {
    events.push(['audit-failed', transaction]);
    throw failure;
  };

  await assert.rejects(registerController.register(req, res), (error) => error === failure);
  assert.deepEqual(events.map(([name]) => name), ['begin', 'create', 'permissions', 'audit-failed', 'rollback']);
  assert.equal(events[1][1], events[2][1]);
  assert.equal(events[2][1], events[3][1]);
  assert.equal(req.session.user, undefined);
  assert.equal(req.accountForLog, undefined);
  assert.equal(res.rendered, undefined);
  assert.deepEqual(flashes, []);
});

test('duplicate-key race is rendered as a registration validation error', async () => {
  const { req, res } = request();
  Customer.createWithAccount = async () => {
    throw Object.assign(new Error('Unique constraint'), { number: 2627 });
  };

  await registerController.register(req, res);
  assert.deepEqual(events.map(([name]) => name), ['begin', 'rollback']);
  assert.equal(req.session.user, undefined);
  assert.equal(res.rendered.view, 'customer/register');
  assert.deepEqual(res.rendered.data.errors, [
    'Tên đăng nhập, email hoặc số điện thoại đã tồn tại.',
  ]);
  assert.deepEqual(res.rendered.data.old, {
    username: validBody.username,
    email: validBody.email,
    fullName: validBody.fullName,
    phone: validBody.phone,
  });
});

test('malformed body values and values beyond schema limits do not start a transaction', async () => {
  const cases = [
    {
      name: 'array-valued username',
      body: { ...validBody, username: ['unexpected'] },
    },
    {
      name: 'missing request body',
      body: null,
    },
    {
      name: 'username longer than Accounts.Username',
      body: { ...validBody, username: 'u'.repeat(51) },
    },
    {
      name: 'full name longer than Customers.FullName',
      body: { ...validBody, fullName: 'n'.repeat(101) },
    },
    {
      name: 'email longer than database column',
      body: { ...validBody, email: `${'e'.repeat(140)}@example.com` },
    },
    {
      name: 'malformed email',
      body: { ...validBody, email: 'not-an-email' },
    },
    {
      name: 'bcrypt input longer than 72 bytes',
      body: { ...validBody, password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) },
    },
  ];

  for (const item of cases) {
    events = [];
    const { req, res } = request(item.body);
    await registerController.register(req, res);
    assert.equal(events.length, 0, item.name);
    assert.equal(req.session.user, undefined, item.name);
    assert.equal(res.rendered.view, 'customer/register', item.name);
    assert.ok(res.rendered.data.errors.length > 0, item.name);
    assert.equal(Object.hasOwn(res.rendered.data.old, 'password'), false, item.name);
  }
});

test('existing username is rejected before hashing or opening a transaction', async () => {
  const { req, res } = request();
  Customer.findAccountByUsername = async (value) => (
    value === validBody.username ? { AccountId: 9 } : null
  );

  await registerController.register(req, res);
  assert.equal(events.length, 0);
  assert.equal(req.session.user, undefined);
  assert.deepEqual(res.rendered.data.errors, ['Tên đăng nhập đã được sử dụng.']);
});

test('registration accepts an omitted optional email and stores it as null', async () => {
  const { req, res } = request({ ...validBody, email: '' });
  await registerController.register(req, res);

  const createEvent = events.find(([name]) => name === 'create');
  assert.equal(createEvent[2].email, null);
  assert.equal(req.session.user.accountId, 101);
  assert.equal(res.redirected, '/');
});

test('createWithAccount uses the caller transaction and executes all four writes/reads through it', async () => {
  const calls = [];
  const transaction = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT RoleId')) return [{ RoleId: 3 }];
      if (sql.includes('INSERT INTO dbo.Accounts')) return [{ AccountId: 101 }];
      if (sql.includes('INSERT INTO dbo.Customers')) return [{ CustomerId: 202 }];
      return [];
    },
  };
  db.transaction = async () => {
    throw new Error('Nested transaction must not be started');
  };
  Customer.createWithAccount = actualCreateWithAccount;

  const result = await Customer.createWithAccount({
    username: validBody.username,
    email: validBody.email,
    passwordHash: 'test-password-hash',
    fullName: validBody.fullName,
    phone: validBody.phone,
  }, transaction);

  assert.deepEqual(result, { accountId: 101, customerId: 202, roleId: 3 });
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ sql }) => typeof sql === 'string'));
  assert.match(calls[1].sql, /VALUES \(@username, @email, @passwordHash, @roleId\)/);
  assert.match(calls[2].sql, /VALUES \(@accountId, @fullName, @phone, @email, @avatarUrl\)/);
  assert.deepEqual(calls[1].params, {
    username: validBody.username,
    email: validBody.email,
    passwordHash: 'test-password-hash',
    roleId: 3,
  });
  assert.deepEqual(calls[2].params, {
    accountId: 101,
    fullName: validBody.fullName,
    phone: validBody.phone,
    email: validBody.email,
    avatarUrl: null,
  });
});

test('createWithAccount reports a missing CUSTOMER role instead of dereferencing an empty result', async () => {
  const transaction = { query: async () => [] };
  Customer.createWithAccount = actualCreateWithAccount;
  await assert.rejects(
    Customer.createWithAccount({
      username: validBody.username,
      email: null,
      passwordHash: 'test-password-hash',
      fullName: validBody.fullName,
      phone: validBody.phone,
    }, transaction),
    (error) => error.code === 'CUSTOMER_ROLE_NOT_FOUND',
  );
});

test('createWithAccount retains its self-managed transaction API', async () => {
  Customer.createWithAccount = actualCreateWithAccount;
  let started = false;
  const transaction = {
    async query(sql) {
      if (sql.includes('SELECT RoleId')) return [{ RoleId: 3 }];
      if (sql.includes('INSERT INTO dbo.Accounts')) return [{ AccountId: 101 }];
      if (sql.includes('INSERT INTO dbo.Customers')) return [{ CustomerId: 202 }];
      return [];
    },
  };
  db.transaction = async (work) => {
    started = true;
    return work(transaction);
  };

  const result = await Customer.createWithAccount({
    username: validBody.username,
    email: validBody.email,
    passwordHash: 'test-password-hash',
    fullName: validBody.fullName,
    phone: validBody.phone,
  });
  assert.equal(started, true);
  assert.deepEqual(result, { accountId: 101, customerId: 202, roleId: 3 });
});

test('getPermissions executes on the supplied transaction', async () => {
  const transaction = {
    async query(sql, params) {
      assert.match(sql, /RolePermissions/);
      assert.deepEqual(params, { roleId: 3 });
      return [{ PermCode: 'catalog.view' }];
    },
  };
  db.query = async () => {
    throw new Error('Must use the supplied transaction');
  };
  assert.deepEqual(await Account.getPermissions(3, transaction), ['catalog.view']);
});

test('transactional audit attributes registration to the newly created account', async () => {
  audit.logInTransaction = actualLogInTransaction;
  let logged;
  const transaction = {
    async query(sql, params) {
      logged = { sql, params };
      return [];
    },
  };
  await audit.logInTransaction(
    transaction,
    { session: {}, accountForLog: { AccountId: 101 }, ip: '127.0.0.1' },
    'CREATE',
    'Account',
    101,
    'registration',
  );

  assert.match(logged.sql, /INSERT INTO dbo\.AuditLogs/);
  assert.deepEqual(logged.params, {
    accountId: 101,
    action: 'CREATE',
    entityName: 'Account',
    entityId: '101',
    detail: 'registration',
    ip: '127.0.0.1',
  });
});

test('transactional audit surfaces DB errors as AUDIT_WRITE_FAILED', async () => {
  audit.logInTransaction = actualLogInTransaction;
  const databaseError = Object.assign(new Error('FK failure'), { number: 547 });
  await assert.rejects(
    audit.logInTransaction(
      { query: async () => { throw databaseError; } },
      { session: {}, accountForLog: { AccountId: 101 }, ip: '127.0.0.1' },
      'CREATE',
      'Account',
      101,
    ),
    (error) => error.code === 'AUDIT_WRITE_FAILED' && error.cause === databaseError,
  );
});
