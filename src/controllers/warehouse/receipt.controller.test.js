const assert = require('node:assert/strict');
const test = require('node:test');
const Receipt = require('../../models/goodsReceipt.model');
const Supplier = require('../../models/supplier.model');
const audit = require('../../models/audit.model');
const controller = require('./receipt.controller');

const keys = [[Receipt, 'productsByIds'], [Receipt, 'productOptions'], [Receipt, 'create'], [Receipt, 'post'], [Receipt, 'cancelDraft'], [Supplier, 'findById'], [Supplier, 'options'], [audit, 'logInTransaction']];
const saved = [];
let created;
test.beforeEach(() => {
  saved.length = 0; created = null;
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  Supplier.findById = async (id) => (id === 1 ? { SupplierId: 1, IsActive: 1 } : id === 2 ? { SupplierId: 2, IsActive: 0 } : null);
  Supplier.options = async () => [];
  Receipt.productOptions = async () => [];
  Receipt.productsByIds = async (ids) => [
    { ProductId: 10, Sku: 'RAM-1', IsSerialTracked: 0, IsActive: 1 },
    { ProductId: 11, Sku: 'LAP-1', IsSerialTracked: 1, IsActive: 1 },
    { ProductId: 12, Sku: 'OLD-1', IsSerialTracked: 0, IsActive: 0 },
  ].filter((p) => ids.includes(p.ProductId));
  Receipt.create = async (value) => { created = value; return { receiptId: 5, receiptNo: 'PN2610-00005' }; };
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http(body = {}, params = {}) {
  const flashes = [];
  const req = { body, params, query: {}, session: { user: { accountId: 3, employeeId: 9 } }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}
const form = (items, extra = {}) => ({ supplierId: '1', itemsJson: JSON.stringify(items), ...extra });

test('a valid receipt is saved as draft by the logged-in employee and redirects to its page', async () => {
  const h = http(form([{ productId: 10, qty: 5, unitCost: 200000 }, { productId: 11, qty: 2, unitCost: 12000000, serials: 'S1\nS2' }], { paidAmount: '1000000', note: ' nhập đợt 1 ' }));
  await controller.create(h.req, h.res);
  assert.equal(h.res.redirected, '/warehouse/receipts/5');
  assert.equal(created.supplierId, 1);
  assert.equal(created.note, 'nhập đợt 1');
  assert.deepEqual(created.items[1].serials, ['S1', 'S2']);
  assert.equal(created.paidAmount, 1000000);
});

test('serial-tracked products need exactly qty distinct, well-formed serials', async () => {
  for (const serials of ['S1', 'S1 S1', 'S1,bad serial!', `${'x'.repeat(61)} S2`]) {
    const h = http(form([{ productId: 11, qty: 2, unitCost: 1, serials }]));
    await controller.create(h.req, h.res);
    assert.equal(h.res.statusCode, 400, `serials=${serials}`);
  }
  assert.equal(created, null);
});

test('bad lines are rejected: empty receipt, duplicates, inactive product, bad qty/cost, unknown or inactive supplier', async () => {
  const cases = [
    form([]),
    form([{ productId: 10, qty: 1, unitCost: 1 }, { productId: 10, qty: 1, unitCost: 1 }]),
    form([{ productId: 12, qty: 1, unitCost: 1 }]),
    form([{ productId: 10, qty: 0, unitCost: 1 }]),
    form([{ productId: 10, qty: 1.5, unitCost: 1 }]),
    form([{ productId: 10, qty: 1, unitCost: -5 }]),
    form([{ productId: 999, qty: 1, unitCost: 1 }]),
    form([{ productId: 10, qty: 1, unitCost: 1 }], { supplierId: '2' }),
    form([{ productId: 10, qty: 1, unitCost: 1 }], { supplierId: '77' }),
    form([{ productId: 10, qty: 1, unitCost: 1000 }], { paidAmount: '5000' }),
    { supplierId: '1', itemsJson: '{not json' },
  ];
  for (const body of cases) {
    const h = http(body);
    await controller.create(h.req, h.res);
    assert.equal(h.res.statusCode, 400, JSON.stringify(body));
    assert.ok(h.res.rendered.d.errors.length > 0);
  }
  assert.equal(created, null);
});

test('a duplicate serial in the database is reported with its value and the form is re-rendered with the draft', async () => {
  Receipt.create = async () => { throw Object.assign(new Error('Violation of UNIQUE KEY constraint. The duplicate key value is (S1).'), { number: 2627 }); };
  const h = http(form([{ productId: 11, qty: 1, unitCost: 1, serials: 'S1' }]));
  await controller.create(h.req, h.res);
  assert.equal(h.res.statusCode, 400);
  assert.match(h.res.rendered.d.errors[0], /"S1" đã tồn tại/);
  assert.equal(h.res.rendered.d.draft.items.length, 1);
});

test('posting maps business errors to a flash message and technical errors propagate', async () => {
  Receipt.post = async () => { throw Object.assign(new Error('Chỉ chốt được phiếu nhập ở trạng thái Nháp.'), { number: 50041 }); };
  const h = http({}, { id: '5' });
  await controller.post(h.req, h.res);
  assert.deepEqual(h.flashes[0], ['danger', 'Chỉ chốt được phiếu nhập ở trạng thái Nháp.']);
  assert.equal(h.res.redirected, '/warehouse/receipts/5');

  Receipt.post = async () => { throw Object.assign(new Error('boom'), { number: 233 }); };
  await assert.rejects(controller.post(http({}, { id: '5' }).req, http().res), /boom/);
});

test('only drafts can be cancelled; the outcome is explained to the user', async () => {
  for (const [result, level] of [['ok', 'success'], ['notDraft', 'danger'], ['notFound', 'danger']]) {
    Receipt.cancelDraft = async () => result;
    const h = http({}, { id: '5' });
    await controller.cancel(h.req, h.res);
    assert.equal(h.flashes[0][0], level);
  }
});
