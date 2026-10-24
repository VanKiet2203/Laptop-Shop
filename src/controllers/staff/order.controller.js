// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Mọi chuyển trạng thái đều đi qua stored procedure (đã tự ghi AuditLogs) nên controller không gọi audit.log thêm.
const Order = require('../../models/order.model');
const { isBusinessError } = require('../../core/helpers');

const NOT_FOUND = { layout: 'layouts/staff', title: 'Không tìm thấy' };

function parseId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

// GET /staff/orders
exports.index = async (req, res) => {
  const [result, counts] = await Promise.all([Order.search(req.query, req.query.page), Order.counts()]);
  res.render('staff/orders/index', { title: 'Đơn hàng', orders: result.rows, pg: result.pg, filters: result.filters, counts });
};

// GET /staff/orders/:id
exports.show = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) return res.status(404).render('errors/404', NOT_FOUND);
  const order = await Order.findById(id);
  if (!order) return res.status(404).render('errors/404', NOT_FOUND);
  const history = await Order.history(id);
  res.render('staff/orders/show', { title: `Đơn ${order.OrderNo}`, order, history });
};

// chạy một thao tác chuyển trạng thái, lỗi nghiệp vụ (THROW 50xxx) hiện thành flash thay vì trang 500
async function runAction(req, res, doAction, successMessage) {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Mã đơn hàng không hợp lệ.');
    return res.redirect('/staff/orders');
  }
  try {
    await doAction(id, req.session.user.accountId);
    req.flash('success', successMessage);
  } catch (e) {
    if (!isBusinessError(e)) throw e;
    req.flash('danger', e.message);
  }
  return res.redirect(`/staff/orders/${id}`);
}

// POST /staff/orders/:id/approve - tồn kho giảm, gán serial, tạo bảo hành, phát hành hoá đơn
exports.approve = (req, res) => runAction(req, res, Order.approve, 'Đã duyệt đơn: trừ kho, gán Serial, tạo bảo hành và phát hành hoá đơn.');

// POST /staff/orders/:id/cancel - trả kho; đơn đã thu tiền chuyển sang "Chờ hoàn tiền"
exports.cancel = (req, res) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 255) : '';
  if (!reason) {
    req.flash('danger', 'Vui lòng nhập lý do huỷ đơn.');
    return res.redirect(`/staff/orders/${parseId(req.params.id) || ''}`);
  }
  return runAction(req, res, (id, accountId) => Order.cancel(id, reason, accountId), 'Đã huỷ đơn và trả tồn kho.');
};

// POST /staff/orders/:id/confirm-payment - chỉ cho đơn trả trước đang chờ thanh toán
exports.confirmPayment = (req, res) => runAction(req, res, Order.confirmPayment, 'Đã xác nhận khách thanh toán.');

// POST /staff/orders/:id/complete - giao thành công, đơn COD thu tiền lúc giao, cộng điểm thành viên
exports.complete = (req, res) => runAction(req, res, Order.complete, 'Đã xác nhận giao hàng thành công.');

// POST /staff/orders/:id/confirm-refund - chỉ gọi SAU KHI đã thực sự chuyển tiền lại cho khách
exports.confirmRefund = (req, res) => runAction(req, res, Order.confirmRefund, 'Đã xác nhận hoàn tiền cho khách.');
