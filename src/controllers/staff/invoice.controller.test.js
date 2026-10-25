const assert = require('node:assert/strict');
const test = require('node:test');
const Invoice = require('../../models/invoice.model');
const audit = require('../../models/audit.model');
const controller = require('./invoice.controller');

const keys = [[Invoice, 'findById'], [Invoice, 'markPrinted'], [audit, 'log']];
const saved = [];
let printed;
test.beforeEach(() => {
  saved.length = 0; printed = 0;
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  Invoice.markPrinted = async () => { printed += 1; };
  audit.log = async () => {};
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http(id) {
  const flashes = [];
  const req = { params: { id }, flash: (...a) => flashes.push(a), session: { user: { accountId: 1 } } };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('an issued invoice prints, counts the print and is logged', async () => {
  Invoice.findById = async () => ({ InvoiceId: 7, InvoiceNo: 'HD2610-00007', Status: 'Issued', PrintCount: 2 });
  const h = http('7');
  await controller.print(h.req, h.res);
  assert.equal(h.res.rendered.v, 'staff/invoices/print');
  assert.equal(h.res.rendered.d.layout, false);
  assert.equal(h.res.rendered.d.invoice.PrintCount, 3);
  assert.equal(printed, 1);
});

test('a VOIDED invoice (cancelled order) can never be printed - it would look like a valid invoice', async () => {
  Invoice.findById = async () => ({ InvoiceId: 8, InvoiceNo: 'HD2610-00008', Status: 'Voided', PrintCount: 0 });
  const h = http('8');
  await controller.print(h.req, h.res);
  assert.equal(h.res.rendered, undefined);
  assert.equal(h.res.redirected, '/staff/invoices/8');
  assert.equal(h.flashes[0][0], 'warning');
  assert.match(h.flashes[0][1], /vô hiệu/);
  assert.equal(printed, 0);
});

test('invalid or unknown invoice ids are 404', async () => {
  Invoice.findById = async () => null;
  for (const id of ['abc', '0', '999']) {
    const h = http(id);
    await controller.print(h.req, h.res);
    assert.equal(h.res.statusCode, 404, id);
  }
});
