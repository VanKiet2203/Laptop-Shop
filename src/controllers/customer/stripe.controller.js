// MODULE 3 - KHÁCH MUA HÀNG: thanh toán thẻ qua Stripe Checkout (test mode)
// Đơn luôn được tạo trước (PaymentStatus = Pending); chỉ khi Stripe xác nhận ĐÃ THU TIỀN mới chuyển sang Paid.
// Có 2 đường xác nhận, cùng gọi settle(): trang quay về (return) và webhook - thủ tục SQL idempotent nên gọi cả hai không sao.
const stripe = require('../../core/stripe');
const mailer = require('../../core/mailer');
const CustomerOrder = require('../../models/customerOrder.model');

const isCustomer = (req) => Boolean(req.session.user && req.session.user.customerId);

// Đơn thuộc về người đang thao tác: khách đăng nhập = chủ đơn; khách vãng lai = đơn đặt trong phiên này.
const owns = (req, order) => (isCustomer(req)
  ? order.CustomerId === req.session.user.customerId
  : (req.session.guestOrderIds || []).includes(order.OrderId));

/** Tạo phiên Stripe cho đơn và trả về URL chuyển khách sang trang thanh toán. */
exports.startSession = async (order) => (await stripe.createCheckoutSession(order, mailer.baseUrl())).url;

/** Phiên Stripe đã thu tiền và khớp đơn -> đánh dấu Paid. Trả về đơn nếu thanh toán hợp lệ, ngược lại null. */
async function settle(session) {
  const orderId = Number.parseInt(session && session.metadata && session.metadata.orderId, 10);
  if (!Number.isInteger(orderId)) return null;
  const order = await CustomerOrder.findAfterPlace(orderId);
  if (!order || order.PaymentMethod !== 'Stripe' || !stripe.isPaidFor(session, order)) return null;
  await CustomerOrder.markPaidByGateway(orderId, session.payment_intent || session.id);
  return order;
}

// GET /checkout/stripe/return?session_id=...   (Stripe chuyển khách về sau khi trả tiền)
exports.returnFromStripe = async (req, res) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !stripe.enabled()) return res.redirect('/');
  let order;
  try {
    order = await settle(await stripe.retrieveSession(sessionId));
  } catch (e) {
    req.flash('warning', 'Chưa xác nhận được thanh toán với Stripe. Nếu bạn đã bị trừ tiền, hệ thống sẽ tự cập nhật trong ít phút.');
    return res.redirect('/checkout/success');
  }
  if (!order) return res.redirect('/');
  req.session.lastOrder = { ...(req.session.lastOrder || {}), orderId: order.OrderId };
  req.flash('success', 'Thanh toán thành công qua Stripe. Cảm ơn bạn!');
  return res.redirect('/checkout/success');
};

// POST /checkout/stripe/pay   body: orderId   (thanh toán lại khi lần trước chưa hoàn tất)
exports.pay = async (req, res) => {
  const orderId = Number.parseInt(req.body && req.body.orderId, 10);
  const order = Number.isInteger(orderId) ? await CustomerOrder.findAfterPlace(orderId) : null;
  if (!order || !owns(req, order)) return res.redirect('/');
  const back = isCustomer(req) ? `/orders/${order.OrderId}` : '/checkout/success';
  if (order.PaymentMethod !== 'Stripe' || order.PaymentStatus !== 'Pending' || order.Status === 'Cancelled' || !stripe.enabled()) {
    req.flash('warning', 'Đơn hàng này không thể thanh toán bằng Stripe.');
    return res.redirect(back);
  }
  if (!isCustomer(req)) req.session.lastOrder = { ...(req.session.lastOrder || {}), orderId: order.OrderId };
  try {
    return res.redirect(await exports.startSession(order));
  } catch (e) {
    console.error('[stripe] không tạo được phiên thanh toán:', e.message);
    req.flash('danger', 'Không kết nối được Stripe. Vui lòng thử lại sau ít phút.');
    return res.redirect(back);
  }
};

// POST /stripe/webhook   (body THÔ - xem app.js; không qua session/originCheck, xác thực bằng chữ ký Stripe)
exports.webhook = async (req, res) => {
  if (!stripe.enabled() || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook chưa cấu hình.');
  let event;
  try {
    event = stripe.constructEvent(req.body, req.headers['stripe-signature']);
  } catch (e) {
    return res.status(400).send('Chữ ký không hợp lệ.');
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await settle(event.data.object);
  }
  return res.json({ received: true });
};
