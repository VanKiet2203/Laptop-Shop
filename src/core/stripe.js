// Stripe Checkout (chế độ test: khoá sk_test_...). Khoá CHỈ đọc từ .env ở phía server.
// VND là đơn vị tiền "zero-decimal" của Stripe: unit_amount = số đồng, KHÔNG nhân 100.
const Stripe = require('stripe');

let client;

// sk_ = secret key chuẩn; rk_ = restricted key (cần quyền Checkout Sessions: Write)
const enabled = () => /^(sk|rk)_(test|live)_/.test(process.env.STRIPE_SECRET_KEY || '');
const api = () => {
  if (!enabled()) throw new Error('Stripe chưa được cấu hình (thiếu STRIPE_SECRET_KEY).');
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
};

const amountOf = (order) => Math.round(Number(order.TotalAmount));

/** Tạo phiên thanh toán cho đơn; trả về Checkout Session (có .url để chuyển khách sang trang Stripe). */
const createCheckoutSession = (order, baseUrl) => api().checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    quantity: 1,
    price_data: { currency: 'vnd', unit_amount: amountOf(order), product_data: { name: `Đơn hàng ${order.OrderNo}` } },
  }],
  customer_email: order.ReceiverEmail || undefined,
  client_reference_id: order.OrderNo,
  metadata: { orderId: String(order.OrderId), orderNo: order.OrderNo },
  success_url: `${baseUrl}/checkout/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/checkout/success`,
});

const retrieveSession = (id) => api().checkout.sessions.retrieve(id);

/** Xác minh chữ ký webhook trên body thô; ném lỗi nếu sai chữ ký. */
const constructEvent = (rawBody, signature) => api().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

/** Phiên đã thu tiền VÀ khớp đơn (đúng mã đơn, đúng số tiền, đúng loại tiền) -> mới được đánh dấu Paid. */
const isPaidFor = (session, order) => Boolean(session
  && session.payment_status === 'paid'
  && session.currency === 'vnd'
  && session.amount_total === amountOf(order)
  && session.metadata && String(session.metadata.orderId) === String(order.OrderId));

module.exports = { enabled, createCheckoutSession, retrieveSession, constructEvent, isPaidFor, amountOf };
