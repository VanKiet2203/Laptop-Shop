const assert = require('node:assert/strict');
const test = require('node:test');
const Checkout = require('../../models/checkout.model');
const Customer = require('../../models/customer.model');
const CustomerOrder = require('../../models/customerOrder.model');
const Promotion = require('../../models/promotion.model');
const Cart = require('../../models/cart.model');
const mailer = require('../../core/mailer');
const controller = require('./checkout.controller');
// Địa giới lấy từ API ngoài: trong test thay bằng bản giả để không gọi mạng
require('../../core/geo').validate = async (province) => (['TP. Hồ Chí Minh', 'TP. Hà Nội'].includes(province) ? null : 'Tỉnh/Thành phố không hợp lệ.');

const keys = [[Checkout, 'placeOrder'], [Checkout, 'getCheckoutData'], [Customer, 'findAddress'], [Customer, 'addAddress'],
  [Customer, 'fillPhoneIfEmpty'], [Customer, 'findByAccountId'], [CustomerOrder, 'findAfterPlace'], [Promotion, 'active'], [mailer, 'sendMail'], [Cart, 'removeMany'], [Cart, 'count']];
let mails;
const saved = [];
let placed;
let extra;

test.beforeEach(() => {
  saved.length = 0;
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  placed = [];
  extra = [];
  mails = [];
  mailer.sendMail = async (m) => { mails.push(m); return { sent: false, mode: 'outbox' }; };
  Checkout.placeOrder = async (args) => { placed.push(args); return { orderId: 77, status: 'Pending' }; };
  Checkout.getCheckoutData = async () => ({ items: [{ ProductId: 1, Quantity: 1, SalePrice: 100 }], subtotal: 100, totalAmount: 110, addresses: [], paymentMethods: [] });
  Cart.removeMany = async (id, ids) => { extra.push(['removeMany', id, ids]); };
  Cart.count = async () => 2;
  Customer.findAddress = async () => null;
  Customer.addAddress = async (id, a) => { extra.push(['addAddress', id, a]); return 5; };
  Customer.fillPhoneIfEmpty = async (id, phone) => { extra.push(['phone', id, phone]); };
  Customer.findByAccountId = async () => null;
  Promotion.active = async () => [];
  CustomerOrder.findAfterPlace = async (id) => ({ OrderId: id, CustomerId: 7, OrderNo: 'DH2610-00001', ReceiverName: 'Khách A', ReceiverPhone: '0912345678', ShippingAddress: 'x', PaymentMethod: 'COD', Status: 'Pending', Subtotal: 100, ShippingFee: 30000, VatAmount: 10, TotalAmount: 110, DiscountAmount: 0, CreatedAt: new Date(), Note: null, items: [{ ProductName: 'SP <b>', Quantity: 1, UnitPrice: 100, LineTotal: 100 }] });
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function request(body, session = {}) {
  const flashes = [];
  const req = { body, session: { cart: [{ productId: 1, qty: 1 }], ...session }, flash: (...a) => flashes.push(a) };
  const res = { redirect(l) { this.redirected = l; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, status(c) { this.statusCode = c; return this; } };
  return { req, res, flashes };
}
const guestBody = {
  paymentMethod: 'COD', email: 'Khach.A@Example.com', receiverName: 'Khách A', receiverPhone: '0912 345 678', addressLine: '1 Đường A', province: 'TP. Hồ Chí Minh',
};

test('guest must fill name, phone, address and province at checkout; nothing is placed otherwise', async () => {
  const { req, res, flashes } = request({ paymentMethod: 'COD', receiverName: '', receiverPhone: '12', addressLine: '', province: 'Nơi không tồn tại' });
  await controller.place(req, res);
  assert.equal(placed.length, 0);
  assert.equal(res.redirected, '/checkout');
  assert.equal(flashes[0][0], 'danger');
  assert.match(flashes[0][1], /họ tên/);
  assert.match(flashes[0][1], /Số điện thoại không hợp lệ/);
  assert.match(flashes[0][1], /Tỉnh\/Thành phố không hợp lệ/);
  assert.equal(req.session.checkoutDraft.receiverPhone, '12', 'giữ lại dữ liệu đã nhập');
});

test('guest order sends the session cart as entries, normalises the phone and clears the cart', async () => {
  const { req, res } = request(guestBody);
  await controller.place(req, res);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].customerId, null);
  assert.deepEqual(placed[0].entries, [{ productId: 1, qty: 1 }]);
  assert.equal(placed[0].receiverPhone, '0912345678');
  assert.equal(placed[0].shippingAddress, '1 Đường A, TP. Hồ Chí Minh');
  assert.equal(res.redirected, '/checkout/success');
  assert.deepEqual(req.session.cart, []);
  assert.equal(req.session.cartCount, 0);
  assert.equal(req.session.lastOrder.orderId, 77);
});

test('an unknown payment method is rejected', async () => {
  const { req, res } = request({ ...guestBody, paymentMethod: 'Bitcoin' });
  await controller.place(req, res);
  assert.equal(placed.length, 0);
  assert.equal(res.redirected, '/checkout');
});

test('installment choices are validated and folded into the order note', async () => {
  const bad = request({ ...guestBody, paymentMethod: 'Installment', instMonths: '7', instPrepay: '30', instProvider: 'card' });
  await controller.place(bad.req, bad.res);
  assert.equal(placed.length, 0);

  const good = request({ ...guestBody, paymentMethod: 'Installment', instMonths: '12', instPrepay: '30', instProvider: 'card', note: 'Giao giờ hành chính' });
  await controller.place(good.req, good.res);
  assert.match(placed[0].note, /^\[TRẢ GÓP\] 12 tháng · trả trước 30% · thẻ tín dụng \(0%\) \| Giao giờ hành chính$/);
});

test('a logged-in customer cannot use someone else\'s saved address id', async () => {
  const { req, res, flashes } = request({ paymentMethod: 'COD', addressId: '999' }, { user: { customerId: 7, accountId: 3 } });
  await controller.place(req, res);
  assert.equal(placed.length, 0);
  assert.match(flashes[0][1], /Địa chỉ giao hàng không hợp lệ/);
});

test('a logged-in customer using a saved address orders from the DB cart; new addresses can be saved and phone filled', async () => {
  Customer.findAddress = async (cid, aid) => (cid === 7 && aid === 5
    ? { ReceiverName: 'B', ReceiverPhone: '0900000001', AddressLine: '2 Đường B', Ward: 'P1', District: 'Q1', Province: 'TP. Hà Nội' } : null);
  const saved1 = request({ paymentMethod: 'BankTransfer', addressId: '5' }, { user: { customerId: 7, accountId: 3 } });
  await controller.place(saved1.req, saved1.res);
  assert.equal(placed[0].customerId, 7);
  assert.deepEqual(placed[0].entries, [{ productId: 1, qty: 1 }]);
  assert.deepEqual(extra.find(([k]) => k === 'removeMany').slice(1), [7, [1]], 'chỉ bỏ phần đã mua khỏi giỏ');
  assert.equal(saved1.req.session.cartCount, 2, 'phần chưa mua vẫn còn trong giỏ');
  assert.equal(placed[0].shippingAddress, '2 Đường B, P1, Q1, TP. Hà Nội');

  placed.length = 0;
  extra.length = 0;
  const fresh = request({ ...guestBody, addressId: 'new', saveAddress: '1' }, { user: { customerId: 7, accountId: 3 } });
  await controller.place(fresh.req, fresh.res);
  assert.equal(placed[0].customerId, 7);
  assert.ok(extra.some(([k]) => k === 'addAddress'));
  assert.deepEqual(extra.find(([k]) => k === 'phone').slice(1), [7, '0912345678']);
});

test('business errors from the stored procedure bring the customer back with the message and their draft', async () => {
  Checkout.placeOrder = async () => { throw Object.assign(new Error('Một số sản phẩm không đủ tồn kho.'), { number: 50021 }); };
  const { req, res, flashes } = request(guestBody);
  await controller.place(req, res);
  assert.equal(res.redirected, '/checkout');
  assert.deepEqual(flashes[0], ['danger', 'Một số sản phẩm không đủ tồn kho.']);
  assert.equal(req.session.checkoutDraft.receiverName, 'Khách A');
  assert.equal(req.session.cart.length, 1, 'giỏ hàng được giữ nguyên khi đặt thất bại');
});

test('success page is only shown to the session that placed the order', async () => {
  const guest = request({}, { lastOrder: { orderId: 77 } });
  await controller.success(guest.req, guest.res);
  assert.equal(guest.res.rendered.v, 'customer/order-success');

  const none = request({});
  await controller.success(none.req, none.res);
  assert.equal(none.res.redirected, '/');

  const other = request({}, { lastOrder: { orderId: 77 }, user: { customerId: 99 } });
  await controller.success(other.req, other.res);
  assert.equal(other.res.redirected, '/orders');
});

test('guest must give an email (needed to receive the order code); a malformed email is rejected', async () => {
  const none = request({ ...guestBody, email: '' });
  await controller.place(none.req, none.res);
  assert.equal(placed.length, 0);
  assert.match(none.flashes[0][1], /nhập email/);

  const bad = request({ ...guestBody, email: 'khong-phai-email' });
  await controller.place(bad.req, bad.res);
  assert.equal(placed.length, 0);
  assert.match(bad.flashes[0][1], /Email không hợp lệ/);
});

test('after an order is placed the confirmation email with the ORDER CODE is sent to the stored lower-cased address', async () => {
  const { req, res } = request(guestBody);
  await controller.place(req, res);
  assert.equal(placed[0].receiverEmail, 'khach.a@example.com');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'khach.a@example.com');
  assert.match(mails[0].subject, /DH2610-00001/);
  assert.match(mails[0].html, /DH2610-00001/);
  assert.match(mails[0].html, /orders\/track\?orderNo=DH2610-00001&amp;phone=0912345678|orders\/track\?orderNo=DH2610-00001&phone=0912345678/);
  assert.ok(!mails[0].html.includes('SP <b>'), 'tên sản phẩm phải được escape trong HTML');
  assert.deepEqual(req.session.lastOrder.mail, { email: 'khach.a@example.com', mode: 'outbox' });
});

test('a failing mail transport never breaks the order (mail result is only reported)', async () => {
  mailer.sendMail = async () => ({ sent: false, mode: 'error' });
  const { req, res } = request(guestBody);
  await controller.place(req, res);
  assert.equal(res.redirected, '/checkout/success');
  assert.equal(req.session.lastOrder.mail.mode, 'error');
});

test('a logged-in customer without typing an email falls back to the profile email', async () => {
  Customer.findByAccountId = async () => ({ Email: 'Profile@Example.com' });
  Customer.findAddress = async () => ({ ReceiverName: 'B', ReceiverPhone: '0900000001', AddressLine: 'x', Province: 'TP. Hà Nội' });
  const { req, res } = request({ paymentMethod: 'COD', addressId: '5' }, { user: { customerId: 7, accountId: 3 } });
  await controller.place(req, res);
  assert.equal(placed[0].receiverEmail, 'profile@example.com');
  assert.equal(mails[0].to, 'profile@example.com');
});
