const assert = require('node:assert/strict');
const test = require('node:test');
const Product = require('../../models/product.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./product.controller');

const originals = {};
let events;

const options = {
  categories: [{ CategoryId: 2, CategoryName: 'Laptop', IsActive: true }],
  brands: [{ BrandId: 3, BrandName: 'Acme', IsActive: true }],
  attributes: [{ AttributeId: 5, AttrName: 'RAM', Unit: 'GB' }],
};
const currentProduct = {
  ProductId: 10,
  Sku: 'LAPTOP-1',
  ProductName: 'Laptop One',
  Slug: 'laptop-one',
  CategoryId: 2,
  BrandId: 3,
  CategoryIsActive: true,
  BrandIsActive: true,
  IsSerialTracked: true,
  IsActive: true,
};

test.beforeEach(() => {
  events = [];
  const methods = [
    'staffCatalogOptions', 'staffAttributesOf', 'imagesOf', 'staffSearch', 'staffFindById',
    'serialTrackingIsLocked', 'uniqueProductSlug', 'createManaged', 'updateManaged', 'removeManaged',
  ];
  for (const key of methods) originals[`Product.${key}`] = { object: Product, key, value: Product[key] };
  for (const [object, key, name] of [
    [db, 'transaction', 'db.transaction'],
    [audit, 'logInTransaction', 'audit.logInTransaction'],
  ]) originals[name] = { object, key, value: object[key] };

  Product.staffCatalogOptions = async () => options;
  Product.staffAttributesOf = async () => [];
  Product.imagesOf = async () => [];
  Product.staffSearch = async () => ({ rows: [], total: 0, page: 1, pageSize: 20 });
  Product.staffFindById = async () => currentProduct;
  Product.serialTrackingIsLocked = async () => false;
  Product.uniqueProductSlug = async (slug) => slug;
  Product.createManaged = async (data, transaction) => {
    events.push(['create', data, transaction]);
    return { productId: 99 };
  };
  Product.updateManaged = async (id, data, transaction) => {
    events.push(['update', id, data, transaction]);
    return { updated: true };
  };
  Product.removeManaged = async (id, transaction) => {
    events.push(['remove', id, transaction]);
    return { deactivated: true };
  };
  db.transaction = async (work) => {
    const transaction = { id: 'product-tx' };
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

const validProduct = {
  sku: 'new-1',
  productName: '  New Laptop ',
  categoryId: '2',
  brandId: '3',
  salePrice: '25000000',
  warrantyMonths: '24',
  shortDesc: 'Lightweight',
  description: 'Details',
  imageUrls: 'https://cdn.example.com/laptop.jpg',
  attr_5: ' 16 ',
  isSerialTracked: '1',
};

test('product creation validates and audits server-parsed values in one transaction', async () => {
  const { req, res, flashes } = request(validProduct);

  await controller.create(req, res);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit', 'commit']);
  const created = events[1][1];
  assert.equal(created.sku, 'NEW-1');
  assert.equal(created.productName, 'New Laptop');
  assert.equal(created.salePrice, 25000000);
  assert.equal(created.categoryId, 2);
  assert.equal(created.brandId, 3);
  assert.equal(created.slug, 'new-laptop');
  assert.deepEqual(created.imageUrls, ['https://cdn.example.com/laptop.jpg']);
  assert.deepEqual(created.attributeValues, [{ attributeId: 5, attrValue: '16' }]);
  assert.equal(events[1][2], events[0][1]);
  assert.equal(events[2][1], events[0][1]);
  assert.deepEqual(events[2].slice(2), ['CREATE', 'Product', 99, 'NEW-1 - New Laptop']);
  assert.deepEqual(flashes, [['success', 'Đã thêm sản phẩm.']]);
  assert.equal(res.redirected, '/staff/products');
});

test('invalid image protocol and untrusted attribute IDs are rejected before transaction', async (t) => {
  for (const [name, body] of [
    ['unsafe image URL', { ...validProduct, imageUrls: 'javascript:alert(1)' }],
    ['unknown attribute', { ...validProduct, attr_999: 'value' }],
    ['fractional price', { ...validProduct, salePrice: '1.5' }],
  ]) {
    await t.test(name, async () => {
      events.length = 0;
      const { req, res, flashes } = request(body);
      await controller.create(req, res);
      assert.deepEqual(events, []);
      assert.equal(flashes[0][0], 'danger');
      assert.equal(res.redirected, '/staff/products/new');
    });
  }
});

test('inactive category or brand is rejected before product creation', async () => {
  Product.staffCatalogOptions = async () => ({
    ...options,
    brands: [{ BrandId: 3, BrandName: 'Acme', IsActive: false }],
  });
  const { req, res, flashes } = request(validProduct);

  await controller.create(req, res);

  assert.deepEqual(events, []);
  assert.equal(flashes[0][0], 'danger');
  assert.equal(res.redirected, '/staff/products/new');
});

test('update preserves serial tracking when the form omits its field', async () => {
  const { req, res, flashes } = request({
    ...validProduct,
    isSerialTracked: undefined,
    isActive: '1',
  }, { id: '10' });

  await controller.update(req, res);

  const updateEvent = events.find(([event]) => event === 'update');
  assert.equal(updateEvent[2].isSerialTracked, true);
  assert.equal(updateEvent[2].isActive, true);
  assert.equal(events.find(([event]) => event === 'audit')[4], 10);
  assert.deepEqual(flashes, [['success', 'Đã cập nhật sản phẩm.']]);
  assert.equal(res.redirected, '/staff/products');
});

test('invalid product ID is rejected without model or transaction calls', async () => {
  const { req, res, flashes } = request({}, { id: '1.5' });

  await controller.remove(req, res);

  assert.deepEqual(events, []);
  assert.equal(flashes[0][0], 'danger');
  assert.equal(res.redirected, '/staff/products');
});

test('deleting referenced or stocked product audits the soft-deactivation outcome', async () => {
  const { req, res, flashes } = request({}, { id: '10' });

  await controller.remove(req, res);

  const auditEvent = events.find(([event]) => event === 'audit');
  assert.deepEqual(auditEvent.slice(2), [
    'DELETE', 'Product', 10, 'Đặt ngừng bán để giữ nguyên lịch sử/tồn kho.',
  ]);
  assert.deepEqual(flashes, [['success', 'Sản phẩm đã được ngừng bán; dữ liệu lịch sử và tồn kho được giữ nguyên.']]);
  assert.equal(res.redirected, '/staff/products');
});

test('audit failure rolls back product creation and propagates', async () => {
  const failure = Object.assign(new Error('Audit failure'), { code: 'AUDIT_WRITE_FAILED' });
  audit.logInTransaction = async (transaction) => {
    events.push(['audit-failed', transaction]);
    throw failure;
  };
  const { req, res } = request(validProduct);

  await assert.rejects(controller.create(req, res), (error) => error === failure);

  assert.deepEqual(events.map(([event]) => event), ['begin', 'create', 'audit-failed', 'rollback']);
  assert.equal(events[1][2], events[3][1]);
});
