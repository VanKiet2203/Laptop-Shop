const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const mailer = require('./mailer');
const { orderConfirmation, orderCodesReminder } = require('./mailTemplates');

const order = {
  OrderNo: 'DH2610-00042', ReceiverName: 'An <script>x</script>', ReceiverPhone: '0912345678', ShippingAddress: '1 Đường "A", Q1',
  PaymentMethod: 'BankTransfer', Status: 'Approved', CreatedAt: new Date('2026-10-24T08:30:00'), Subtotal: 1000000, DiscountAmount: 80000,
  ShippingFee: 30000, VatAmount: 92000, TotalAmount: 1042000, PromoCode: 'BTS2026', Note: null,
  items: [{ ProductName: 'Chuột <i>Logi</i>', Quantity: 2, UnitPrice: 500000, LineTotal: 1000000 }],
};

test('confirmation email shows the order code prominently, a tracking link, QR payment info, and escapes user data', () => {
  const m = orderConfirmation(order, 'https://shop.example');
  assert.match(m.subject, /DH2610-00042/);
  assert.match(m.html, /Mã đơn hàng của bạn/);
  assert.match(m.html, /DH2610-00042/);
  assert.match(m.html, /https:\/\/shop\.example\/orders\/track\?orderNo=DH2610-00042&amp;phone=0912345678/);
  assert.match(m.html, /img\.vietqr\.io\/image\/VCB-/);
  assert.match(m.html, /amount=1042000/);
  assert.ok(!m.html.includes('<script>x</script>'));
  assert.ok(!m.html.includes('<i>Logi</i>'));
  assert.match(m.text, /Mã đơn hàng: DH2610-00042/);
});

test('payment instructions follow the payment method (COD / installment)', () => {
  const cod = orderConfirmation({ ...order, PaymentMethod: 'COD', Status: 'Pending' }, 'http://x');
  assert.match(cod.html, /Nhân viên sẽ gọi xác nhận/);
  assert.match(cod.html, /Đang kiểm tra hàng/);
  const inst = orderConfirmation({ ...order, PaymentMethod: 'Installment', Note: '[TRẢ GÓP] 12 tháng · trả trước 30% · thẻ tín dụng (0%)' }, 'http://x');
  assert.match(inst.html, /trả góp 12 tháng, trả trước 30%/);
});

test('reminder email lists each order code with its own tracking link', () => {
  const m = orderCodesReminder([{ OrderNo: 'DH2610-00001', ReceiverPhone: '0912345678', Status: 'Pending', CreatedAt: new Date(), TotalAmount: 5 },
    { OrderNo: 'DH2610-00002', ReceiverPhone: '0912345678', Status: 'Completed', CreatedAt: new Date(), TotalAmount: 6 }], 'http://x');
  assert.match(m.html, /DH2610-00001/);
  assert.match(m.html, /DH2610-00002/);
  assert.match(m.text, /DH2610-00002/);
});

test('without SMTP configuration the email is written to outbox/ instead of being lost or crashing', async () => {
  const saved = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  const log = console.log;
  console.log = () => {};
  let result;
  try {
    result = await mailer.sendMail({ to: 'a@b.com', subject: 'Test', html: '<p>hi</p>', text: 'hi' });
  } finally { console.log = log; if (saved !== undefined) process.env.SMTP_HOST = saved; }
  assert.equal(result.mode, 'outbox');
  const file = path.join(mailer.OUTBOX, result.file);
  assert.ok(fs.existsSync(file));
  assert.match(fs.readFileSync(file, 'utf8'), /Subject: Test/);
  fs.unlinkSync(file);
});

test('sendMail swallows transport errors', async () => {
  const saved = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT };
  process.env.SMTP_HOST = '127.0.0.1'; process.env.SMTP_PORT = '1'; // cổng đóng -> lỗi kết nối
  const err = console.error; console.error = () => {};
  try {
    const result = await mailer.sendMail({ to: 'a@b.com', subject: 'x', html: 'x', text: 'x' });
    assert.deepEqual(result, { sent: false, mode: 'error' });
  } finally {
    console.error = err;
    if (saved.host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = saved.host;
    if (saved.port === undefined) delete process.env.SMTP_PORT; else process.env.SMTP_PORT = saved.port;
  }
});
