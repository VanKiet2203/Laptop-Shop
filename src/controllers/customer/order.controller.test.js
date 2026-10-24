const assert = require('node:assert/strict');
const test = require('node:test');
const CustomerOrder = require('../../models/customerOrder.model');
const mailer = require('../../core/mailer');
const controller = require('./order.controller');

const keys = [[CustomerOrder, 'findByNoAndPhone'], [CustomerOrder, 'findCodesByPhoneEmail'], [CustomerOrder, 'findOwned'], [CustomerOrder, 'cancelPending'], [mailer, 'sendMail']];
const saved = [];
let mails;
test.beforeEach(() => {
  saved.length = 0;
  mails = [];
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  mailer.sendMail = async (m) => { mails.push(m); return { sent: true, mode: 'smtp' }; };
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http({ query = {}, body = {}, session = {}, params = {} } = {}) {
  const flashes = [];
  const req = { query, body, params, session: { ...session }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('tracking needs BOTH order code and phone; a mismatch is a 404 that reveals nothing', async () => {
  CustomerOrder.findByNoAndPhone = async (no, phone) => (no === 'DH1' && phone === '0912345678' ? { OrderNo: 'DH1', Status: 'Pending', items: [] } : null);
  const ok = http({ query: { orderNo: 'DH1', phone: '0912345678' } });
  await controller.track(ok.req, ok.res);
  assert.equal(ok.res.rendered.v, 'customer/orderDetails');
  assert.equal(ok.res.rendered.d.guestView, true);

  const bad = http({ query: { orderNo: 'DH1', phone: '0999999999' } });
  await controller.track(bad.req, bad.res);
  assert.equal(bad.res.statusCode, 404);
  assert.equal(bad.res.rendered.v, 'customer/order-track');

  const empty = http();
  await controller.track(empty.req, empty.res);
  assert.equal(empty.res.rendered.d.searched, false);
});

test('"forgot order code" emails the codes only when phone and email both match, with the same reply either way', async () => {
  CustomerOrder.findCodesByPhoneEmail = async (phone, email) => (phone === '0912345678' && email === 'a@b.com'
    ? [{ OrderNo: 'DH1', ReceiverPhone: phone, Status: 'Pending', CreatedAt: new Date(), TotalAmount: 5 }] : []);
  const hit = http({ body: { phone: '0912345678', email: 'a@b.com' } });
  await controller.resendCodes(hit.req, hit.res);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'a@b.com');
  assert.match(mails[0].html, /DH1/);

  const miss = http({ body: { phone: '0900000000', email: 'a@b.com' } });
  await controller.resendCodes(miss.req, miss.res);
  assert.equal(mails.length, 1, 'không gửi mail khi không khớp');
  assert.equal(miss.flashes[0][0], hit.flashes[0][0]);
  assert.equal(miss.flashes[0][1], hit.flashes[0][1], 'cùng một thông báo dù khớp hay không (không cho dò)');
});

test('"forgot order code" is rate limited per session', async () => {
  CustomerOrder.findCodesByPhoneEmail = async () => [];
  const first = http({ body: { phone: '0912345678', email: 'a@b.com' } });
  await controller.resendCodes(first.req, first.res);
  const second = http({ body: { phone: '0912345678', email: 'a@b.com' }, session: first.req.session });
  await controller.resendCodes(second.req, second.res);
  assert.equal(second.flashes[0][0], 'warning');
});

test('a customer can only cancel an order that belongs to them', async () => {
  CustomerOrder.findOwned = async () => null;
  CustomerOrder.cancelPending = async () => assert.fail('không được huỷ đơn của người khác');
  const { req, res } = http({ params: { id: '5' }, session: { user: { accountId: 1, customerId: 9 } } });
  await controller.cancel(req, res);
  assert.equal(res.statusCode, 404);
});
