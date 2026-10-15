const assert = require('node:assert/strict');
const test = require('node:test');
const Attribute = require('../../models/attribute.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./attribute.controller');

const originals = {};
let events;

test.beforeEach(() => {
  events = [];
  for (const [object, key] of [
    [Attribute, 'list'], [Attribute, 'findById'], [Attribute, 'create'], [Attribute, 'update'], [Attribute, 'remove'],
    [db, 'transaction'], [audit, 'logInTransaction'],
  ]) originals[`${object === Attribute ? 'Attribute' : object === db ? 'db' : 'audit'}.${key}`] = { object, key, value: object[key] };

  Attribute.list = async () => [];
  Attribute.findById = async () => ({ AttributeId: 8, AttrCode: 'CPU', AttrName: 'CPU', Unit: 'GHz' });
  Attribute.create = async (data, transaction) => {
    events.push(['create', data, transaction]);
    return 81;
  };
  Attribute.update = async (id, data, transaction) => {
    events.push(['update', id, data, transaction]);
    return true;
  };
  Attribute.remove = async (id, transaction) => {
    events.push(['remove', id, transaction]);
    return true;
  };
  db.transaction = async (work) => {
    const transaction = { id: 'attribute-tx' };
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
    req: { body, params, flash(...args) { flashes.push(args); } },
    res: {
      status(code) { this.statusCode = code; return this; },
      render(view, data) { this.rendered = { view, data }; return this; },
      redirect(location) { this.redirected = location; return this; },
    },
    flashes,
  };
}

test('attribute creation normalizes code and audits the returned ID transactionally', async () => {
  const { req, res, flashes } = request({
    attrCode: '  cpu_clock ',
    attrName: '  Tốc độ CPU ',
    unit: ' GHz ',
    isFilterable: '1',
  });

  await controller.create(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit', 'commit']);
  assert.deepEqual(events[1][1], {
    attrCode: 'CPU_CLOCK',
    attrName: 'Tốc độ CPU',
    unit: 'GHz',
    isFilterable: true,
  });
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['CREATE', 'Attribute', 81, 'CPU_CLOCK - Tốc độ CPU']);
  assert.deepEqual(flashes, [['success', 'Đã thêm thuộc tính kỹ thuật.']]);
  assert.equal(res.redirected, '/staff/attributes');
});

test('attribute code rejects punctuation and overlong names before database writes', async () => {
  const { req, res, flashes } = request({ attrCode: 'bad-code', attrName: 'x'.repeat(101), unit: '' });

  await controller.create(req, res);

  assert.deepEqual(events, []);
  assert.equal(flashes[0][0], 'danger');
  assert.equal(res.redirected, '/staff/attributes/new');
});

test('attribute audit errors rollback and propagate', async () => {
  const failure = Object.assign(new Error('Audit failure'), { code: 'AUDIT_WRITE_FAILED' });
  audit.logInTransaction = async (transaction) => {
    events.push(['audit-failed', transaction]);
    throw failure;
  };
  const { req, res } = request({ attrCode: 'RAM_TYPE', attrName: 'RAM type' });

  await assert.rejects(controller.create(req, res), (error) => error === failure);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit-failed', 'rollback']);
  assert.equal(events[1][2], events[3][1]);
});

test('attribute update audits its changed fields transactionally', async () => {
  const { req, res, flashes } = request({
    attrCode: 'RAM_SPEED',
    attrName: 'Tốc độ RAM',
    unit: 'MHz',
    isFilterable: '1',
  }, { id: '8' });

  await controller.update(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'update', 'audit', 'commit']);
  assert.equal(events[1][3], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['UPDATE', 'Attribute', 8, 'RAM_SPEED - Tốc độ RAM']);
  assert.equal(res.redirected, '/staff/attributes');
  assert.deepEqual(flashes, [['success', 'Đã cập nhật thuộc tính kỹ thuật.']]);
});

test('attribute deletion audits the deleted ID in the same transaction', async () => {
  const { req, res, flashes } = request({}, { id: '8' });

  await controller.remove(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'remove', 'audit', 'commit']);
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['DELETE', 'Attribute', 8, 'CPU - CPU']);
  assert.equal(res.redirected, '/staff/attributes');
  assert.deepEqual(flashes, [['success', 'Đã xoá thuộc tính kỹ thuật.']]);
});

test('cannot delete an attribute still used by products or compatibility rules', async () => {
  Attribute.remove = async () => {
    throw Object.assign(new Error('FK'), { number: 547 });
  };
  const { req, res, flashes } = request({}, { id: '8' });

  await controller.remove(req, res);

  assert.equal(flashes[0][0], 'warning');
  assert.equal(res.redirected, '/staff/attributes');
  assert.equal(events.some(([event]) => event === 'audit'), false);
});
