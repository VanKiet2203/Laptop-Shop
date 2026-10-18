const assert = require('node:assert/strict');
const test = require('node:test');
const Category = require('../../models/category.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./category.controller');

const originals = {};
let events;

test.beforeEach(() => {
  events = [];
  for (const [object, key] of [
    [Category, 'list'], [Category, 'findById'], [Category, 'uniqueSlug'], [Category, 'create'],
    [Category, 'update'], [Category, 'remove'], [Category, 'hasActiveSubtreeReferences'],
    [db, 'transaction'], [audit, 'logInTransaction'],
  ]) originals[`${object === Category ? 'Category' : object === db ? 'db' : 'audit'}.${key}`] = { object, key, value: object[key] };

  Category.list = async () => [];
  Category.findById = async () => ({
    CategoryId: 1, ParentId: null, CategoryName: 'Laptops', Slug: 'laptops',
    SortOrder: 0, IsActive: true,
  });
  Category.uniqueSlug = async (slug) => slug;
  Category.create = async (data, transaction) => {
    events.push(['create', data, transaction]);
    return 22;
  };
  Category.update = async (id, data, transaction) => {
    events.push(['update', id, data, transaction]);
    return true;
  };
  Category.remove = async (id, transaction) => {
    events.push(['remove', id, transaction]);
    return true;
  };
  Category.hasActiveSubtreeReferences = async () => false;
  db.transaction = async (work) => {
    const transaction = { id: 'category-tx' };
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

test('category creation slugifies the name and audits using the inserted ID', async () => {
  const { req, res, flashes } = request({
    categoryName: '  Máy tính xách tay ',
    parentId: '',
    sortOrder: '2',
  });

  await controller.create(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit', 'commit']);
  assert.equal(events[1][1].slug, 'may-tinh-xach-tay');
  assert.equal(events[1][1].categoryName, 'Máy tính xách tay');
  assert.equal(events[1][2], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['CREATE', 'Category', 22, 'Máy tính xách tay']);
  assert.deepEqual(flashes, [['success', 'Đã thêm danh mục.']]);
  assert.equal(res.redirected, '/staff/categories');
});

test('create rejects an inactive or missing parent before opening a transaction', async () => {
  Category.list = async () => [{
    CategoryId: 4, ParentId: null, CategoryName: 'Stopped', IsActive: false, SortOrder: 0,
  }];
  const { req, res, flashes } = request({
    categoryName: 'Child',
    parentId: '4',
    sortOrder: '0',
  });

  await controller.create(req, res);

  assert.deepEqual(events, []);
  assert.equal(res.redirected, '/staff/categories/new');
  assert.equal(flashes[0][0], 'danger');
});

test('category creation at depth 101 is rejected before opening transaction', async () => {
  const rows = Array.from({ length: Category.MAX_DEPTH }, (_, index) => ({
    CategoryId: index + 1,
    ParentId: index === 0 ? null : index,
    CategoryName: `Level ${index + 1}`,
    IsActive: true,
    SortOrder: index,
  }));
  Category.list = async () => rows;
  const { req, res, flashes } = request({
    categoryName: 'Too deep',
    parentId: String(Category.MAX_DEPTH),
    sortOrder: '0',
  });

  await controller.create(req, res);

  assert.deepEqual(events, []);
  assert.match(flashes[0][1], /100 cấp/);
  assert.equal(res.redirected, '/staff/categories/new');
});

test('moving a category below its own descendant is rejected without mutation', async () => {
  const rows = [
    { CategoryId: 1, ParentId: null, CategoryName: 'Root', IsActive: true, SortOrder: 0 },
    { CategoryId: 2, ParentId: 1, CategoryName: 'Child', IsActive: true, SortOrder: 0 },
  ];
  Category.list = async () => rows;
  Category.findById = async () => rows[0];
  const { req, res, flashes } = request({
    categoryName: 'Root',
    parentId: '2',
    sortOrder: '0',
    isActive: '1',
  }, { id: '1' });

  await controller.update(req, res);

  assert.deepEqual(events, []);
  assert.equal(flashes[0][0], 'danger');
  assert.equal(res.redirected, '/staff/categories/1/edit');
});

test('category update writes audit with the changed category in one transaction', async () => {
  const rows = [{
    CategoryId: 1, ParentId: null, CategoryName: 'Root', IsActive: true, SortOrder: 0,
  }];
  Category.list = async () => rows;
  Category.findById = async () => ({
    CategoryId: 1, ParentId: null, CategoryName: 'Root', Slug: 'root',
    SortOrder: 0, IsActive: true,
  });
  const { req, res, flashes } = request({
    categoryName: 'Updated root',
    parentId: '',
    sortOrder: '3',
    isActive: '1',
  }, { id: '1' });

  await controller.update(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'update', 'audit', 'commit']);
  assert.equal(events[1][3], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['UPDATE', 'Category', 1, 'Updated root']);
  assert.equal(res.redirected, '/staff/categories');
  assert.deepEqual(flashes, [['success', 'Đã cập nhật danh mục.']]);
});

test('category deletion records its audit after the delete succeeds', async () => {
  const { req, res, flashes } = request({}, { id: '1' });

  await controller.remove(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'remove', 'audit', 'commit']);
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['DELETE', 'Category', 1, 'Laptops']);
  assert.equal(res.redirected, '/staff/categories');
  assert.deepEqual(flashes, [['success', 'Đã xoá danh mục.']]);
});

test('category audit failure rolls the mutation back and propagates', async () => {
  const failure = Object.assign(new Error('Audit failure'), { code: 'AUDIT_WRITE_FAILED' });
  audit.logInTransaction = async (transaction) => {
    events.push(['audit-failed', transaction]);
    throw failure;
  };
  const { req, res } = request({
    categoryName: 'New root',
    parentId: '',
    sortOrder: '0',
  });

  await assert.rejects(controller.create(req, res), (error) => error === failure);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit-failed', 'rollback']);
  assert.equal(events[1][2], events[3][1]);
});

test('active descendants prevent category deactivation before mutation', async () => {
  Category.list = async () => [{
    CategoryId: 1, ParentId: null, CategoryName: 'Root', IsActive: true, SortOrder: 0,
  }];
  Category.hasActiveSubtreeReferences = async () => true;
  const { req, res, flashes } = request({
    categoryName: 'Root',
    parentId: '',
    sortOrder: '0',
  }, { id: '1' });

  await controller.update(req, res);

  assert.deepEqual(events, []);
  assert.equal(flashes[0][0], 'warning');
  assert.equal(res.redirected, '/staff/categories/1/edit');
});

test('SQL depth guard failures are converted to an actionable flash message', async () => {
  Category.create = async () => {
    throw Object.assign(new Error('Depth exceeded'), { number: 50006 });
  };
  const { req, res, flashes } = request({
    categoryName: 'Race depth',
    parentId: '',
    sortOrder: '0',
  });

  await controller.create(req, res);

  assert.equal(flashes[0][0], 'danger');
  assert.match(flashes[0][1], /100 cấp/);
  assert.equal(res.redirected, '/staff/categories/new');
});
