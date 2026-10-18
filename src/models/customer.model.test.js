const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../config/db');
const Customer = require('./customer.model');

const originalTransaction = db.transaction;
let calls;
let transaction;

test.beforeEach(() => {
  calls = [];
  transaction = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT CustomerId FROM dbo.Customers')) return [{ CustomerId: 7 }];
      if (sql.includes('SELECT AddressId FROM dbo.CustomerAddresses')) return [];
      if (sql.includes('INSERT INTO dbo.CustomerAddresses')) return [{ AddressId: 12 }];
      return [];
    },
  };
  db.transaction = (work) => work(transaction);
});

test.afterEach(() => {
  db.transaction = originalTransaction;
});

test('first saved address is made default within the address transaction', async () => {
  const addressId = await Customer.addAddress(7, {
    receiverName: 'Người nhận',
    receiverPhone: '0912345678',
    addressLine: '1 Đường A',
    ward: '',
    district: '',
    province: 'TP. Hồ Chí Minh',
    isDefault: false,
  });

  assert.equal(addressId, 12);
  const insert = calls.find((call) => call.sql.includes('INSERT INTO dbo.CustomerAddresses'));
  assert.equal(insert.params.isDefault, 1);
  assert.ok(calls[0].sql.includes('UPDLOCK, HOLDLOCK'));
});

test('selecting a new default clears the previous default before inserting', async () => {
  transaction.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT CustomerId FROM dbo.Customers')) return [{ CustomerId: 7 }];
    if (sql.includes('SELECT AddressId FROM dbo.CustomerAddresses')) return [{ AddressId: 3 }];
    if (sql.includes('INSERT INTO dbo.CustomerAddresses')) return [{ AddressId: 12 }];
    return [];
  };

  await Customer.addAddress(7, {
    receiverName: 'Người nhận',
    receiverPhone: '0912345678',
    addressLine: '1 Đường A',
    ward: '',
    district: '',
    province: 'TP. Hồ Chí Minh',
    isDefault: true,
  });

  const clearIndex = calls.findIndex((call) => call.sql.includes('SET IsDefault = 0'));
  const insertIndex = calls.findIndex((call) => call.sql.includes('INSERT INTO dbo.CustomerAddresses'));
  assert.ok(clearIndex > 0);
  assert.ok(insertIndex > clearIndex);
});

test('default changes are rejected without mutation when address is not owned by customer', async () => {
  transaction.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT AddressId FROM dbo.CustomerAddresses')) return [];
    return [{ CustomerId: 7 }];
  };

  const changed = await Customer.setDefaultAddress(7, 999);

  assert.equal(changed, false);
  assert.equal(calls.some((call) => call.sql.includes('UPDATE dbo.CustomerAddresses')), false);
});

test('deleting the default promotes the oldest remaining owned address', async () => {
  transaction.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT IsDefault FROM dbo.CustomerAddresses')) return [{ IsDefault: true }];
    if (sql.includes('SELECT CustomerId FROM dbo.Customers')) return [{ CustomerId: 7 }];
    return [];
  };

  const deleted = await Customer.deleteAddress(7, 12);

  assert.equal(deleted, true);
  const promote = calls.find((call) => call.sql.includes('SELECT TOP (1) AddressId'));
  assert.ok(promote);
  assert.match(promote.sql, /ORDER BY AddressId/);
  assert.equal(promote.params.customerId, 7);
});

test('profile fields update together in one transaction', async () => {
  const updated = await Customer.updateProfile(3, {
    fullName: 'Tên mới',
    phone: '0987654321',
    email: 'new@example.com',
  });

  assert.equal(updated, true);
  assert.equal(calls.filter((call) => call.sql.includes('UPDATE dbo.Customers')).length, 1);
  assert.equal(calls.filter((call) => call.sql.includes('UPDATE dbo.Accounts')).length, 1);
  assert.equal(calls[1].params.email, 'new@example.com');
  assert.equal(calls[2].params.email, 'new@example.com');
});
