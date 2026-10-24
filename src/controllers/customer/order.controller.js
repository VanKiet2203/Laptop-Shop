// MODULE 3 - KHÁCH MUA HÀNG
// Đơn hàng của khách đã đăng nhập (/orders) và tra cứu cho khách chưa đăng nhập (/orders/track: mã đơn + số điện thoại).
const CustomerOrder = require('../../models/customerOrder.model');
const mailer = require('../../core/mailer');
const { orderCodesReminder } = require('../../core/mailTemplates');

const STATUS_FILTERS = new Set(['Pending', 'Approved', 'Completed', 'Cancelled']);

// GET /orders
exports.index = async (req, res) => {
  const customerId = req.session.user.customerId;
  if (!customerId) {
    return res.status(401).send('Chưa đăng nhập hoặc không phải khách hàng');
  }
  // trạng thái chọn; giá trị lạ thì coi như không lọc
  const status = STATUS_FILTERS.has(req.query.status) ? req.query.status : null;
  const orders = await CustomerOrder.listByCustomer(customerId, status);
  res.render('customer/orders', { title: 'Đơn hàng của tôi', orders, status });
};

// GET /orders/:id
exports.show = async (req, res) => {
  const customerId = req.session.user.customerId;
  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(404).render('errors/404', { title: 'Không tìm thấy đơn hàng' });
  }
  const orderDetails = await CustomerOrder.findOwned(orderId, customerId);
  if (!orderDetails) {
    return res.status(404).render('errors/404', { title: 'Không tìm thấy đơn hàng' });
  }
  res.render('customer/orderDetails', { title: `Đơn hàng ${orderDetails.OrderNo}`, orderDetails, guestView: false });
};

// GET /orders/track  (công khai - khách chưa đăng nhập)
exports.track = async (req, res) => {
  const orderNo = typeof req.query.orderNo === 'string' ? req.query.orderNo.trim().slice(0, 30) : '';
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim().slice(0, 20) : '';
  if (!orderNo && !phone) return res.render('customer/order-track', { title: 'Tra cứu đơn hàng', searched: false, orderNo, phone });

  const order = await CustomerOrder.findByNoAndPhone(orderNo, phone);
  if (!order) {
    return res.status(404).render('customer/order-track', {
      title: 'Tra cứu đơn hàng', searched: true, notFound: true, orderNo, phone,
    });
  }
  return res.render('customer/orderDetails', { title: `Đơn hàng ${order.OrderNo}`, orderDetails: order, guestView: true });
};

// POST /orders/track/resend  - "Quên mã đơn?": gửi lại mã đơn tới email đã dùng khi đặt hàng
// Luôn trả cùng một thông báo dù có khớp hay không (không để người lạ dò xem SĐT/email nào có đơn), và giới hạn 1 lần / 60 giây / phiên.
exports.resendCodes = async (req, res) => {
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim().slice(0, 20) : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().slice(0, 150) : '';
  const now = Date.now();
  if (req.session.lastResend && now - req.session.lastResend < 60 * 1000) {
    req.flash('warning', 'Vui lòng đợi khoảng 1 phút rồi thử lại.');
    return res.redirect('/orders/track');
  }
  req.session.lastResend = now;
  if (/^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email) && phone) {
    const orders = await CustomerOrder.findCodesByPhoneEmail(phone, email);
    if (orders.length) await mailer.sendMail({ to: email, ...orderCodesReminder(orders, mailer.baseUrl()) });
  }
  req.flash('success', 'Nếu thông tin khớp với một đơn hàng, chúng tôi đã gửi email chứa mã đơn tới địa chỉ bạn nhập. Vui lòng kiểm tra hộp thư (cả mục Spam).');
  return res.redirect('/orders/track');
};

// POST /orders/:id/cancel
exports.cancel = async (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  const { accountId, customerId } = req.session.user;
  const reason = (typeof req.body.reason === 'string' && req.body.reason.trim().slice(0, 255)) || 'Khách hàng huỷ đơn';
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(404).render('errors/404', { title: 'Không tìm thấy đơn hàng' });
  }
  // Chỉ huỷ đơn của chính mình; sp_CancelOrder kiểm tra lại quyền sở hữu + trạng thái trong DB
  const owned = await CustomerOrder.findOwned(orderId, customerId);
  if (!owned) return res.status(404).render('errors/404', { title: 'Không tìm thấy đơn hàng' });
  try {
    await CustomerOrder.cancelPending(orderId, accountId, reason);
    req.flash('success', 'Huỷ đơn hàng thành công.');
  } catch (error) {
    if (typeof error.number === 'number' && error.number >= 50000) req.flash('danger', error.message);
    else throw error;
  }
  return res.redirect(`/orders/${orderId}`);
};
