const assert = require('node:assert/strict');
const test = require('node:test');
const Brand = require('../../models/brand.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./brand.controller');

const originals = {};
const brand = { BrandId: 4, BrandName: 'Acme', Country: 'VN', IsActive: true };
let events;

test.beforeEach(() => {
  events = [];
  for (const [object, key] of [
    [Brand, 'list'], [Brand, 'findById'], [Brand, 'create'], [Brand, 'update'], [Brand, 'remove'],
    [db, 'transaction'], [audit, 'logInTransaction'],
  ]) originals[`${object === Brand ? 'Brand' : object === db ? 'db' : 'audit'}.${key}`] = { object, key, value: object[key] };

  Brand.list = async () => [brand];
  Brand.findById = async () => brand;
  Brand.create = async (data, transaction) => {
    events.push(['create', data, transaction]);
    return 45;
  };
  Brand.update = async (id, data, transaction) => {
    events.push(['update', id, data, transaction]);
    return { updated: true };
  };
  Brand.remove = async (id, transaction) => {
    events.push(['remove', id, transaction]);
    return true;
  };
  db.transaction = async (work) => {
    const transaction = { id: 'brand-tx' };
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
  audit.logInTransaction = async (transaction, req, action, entity, id, detail) => {
    events.push(['audit', transaction, action, entity, id, detail]);
  };
});

test.afterEach(() => {
  for (const { object, key, value } of Object.values(originals)) object[key] = value;
  for (const key of Object.keys(originals)) delete originals[key];
});

function request(body = {}, params = {}) {
  const flashes = [];
  return {
    req: { body, params, query: {}, flash(...args) { flashes.push(args); } },
    res: {
      status(code) { this.statusCode = code; return this; },
      render(view, data) { this.rendered = { view, data }; return this; },
      redirect(location) { this.redirected = location; return this; },
    },
    flashes,
  };
}

test('brand creation writes audit with returned ID in the same transaction', async () => {
  const { req, res, flashes } = request({ brandName: '  New Brand ', country: ' VN ' });

  await controller.create(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit', 'commit']);
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['CREATE', 'Brand', 45, 'New Brand']);
  assert.equal(events[1][1].country, 'VN');
  assert.deepEqual(flashes, [['success', 'Đã thêm thương hiệu.']]);
  assert.equal(res.redirected, '/staff/brands');
});

test('invalid brand data is rejected before opening a transaction', async () => {
  const { req, res, flashes } = request({ brandName: ' '.repeat(2), country: '' });

  await controller.create(req, res);

  assert.deepEqual(events, []);
  assert.equal(res.redirected, '/staff/brands/new');
  assert.equal(flashes[0][0], 'danger');
});

test('audit failure rolls back brand creation and propagates the error', async () => {
  const failure = Object.assign(new Error('Audit write failed'), { code: 'AUDIT_WRITE_FAILED' });
  audit.logInTransaction = async (transaction) => {
    events.push(['audit-failed', transaction]);
    throw failure;
  };

  const { req, res } = request({ brandName: 'New Brand' });
  await assert.rejects(controller.create(req, res), (error) => error === failure);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit-failed', 'rollback']);
  assert.equal(events[1][2], events[3][1]);
  assert.equal(res.redirected, undefined);
});

test('deactivation with active products reports a conflict without auditing', async () => {
  Brand.update = async (id, data, transaction) => {
    events.push(['update', id, data, transaction]);
    return { updated: false, hasActiveProducts: true };
  };
  const { req, res, flashes } = request({ brandName: 'Acme', isActive: '0' }, { id: '4' });

  await controller.update(req, res);

  assert.equal(events.some(([event]) => event === 'audit'), false);
  assert.equal(res.redirected, '/staff/brands/4/edit');
  assert.equal(flashes[0][0], 'warning');
});

test('brand update commits its audit entry with the mutation transaction', async () => {
  const { req, res, flashes } = request({ brandName: 'Acme Updated', isActive: '1' }, { id: '4' });

  await controller.update(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'update', 'audit', 'commit']);
  assert.equal(events[1][3], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['UPDATE', 'Brand', 4, 'Acme Updated']);
  assert.equal(res.redirected, '/staff/brands');
  assert.deepEqual(flashes, [['success', 'Đã cập nhật thương hiệu.']]);
});

test('brand deletion audits only after a successful delete in the transaction', async () => {
  const { req, res, flashes } = request({}, { id: '4' });

  await controller.remove(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'remove', 'audit', 'commit']);
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['DELETE', 'Brand', 4, undefined]);
  assert.equal(res.redirected, '/staff/brands');
  assert.deepEqual(flashes, [['success', 'Đã xoá thương hiệu.']]);
});

test('foreign-key failure deleting a referenced brand is reported as a warning', async () => {
  Brand.remove = async () => {
    throw Object.assign(new Error('FK'), { number: 547 });
  };
  const { req, res, flashes } = request({}, { id: '4' });

  await controller.remove(req, res);

  assert.equal(flashes[0][0], 'warning');
  assert.equal(res.redirected, '/staff/brands');
});
