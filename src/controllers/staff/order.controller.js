// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/orders
exports.index = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Danh sách đơn hàng",
    "route": "GET /staff/orders",
    "tasks": [
      "Lọc theo trạng thái, khoảng ngày, tìm theo số đơn/tên/SĐT khách; phân trang"
    ],
    "db": "Orders, Customers",
    "rubric": "A4",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/orders/:id
exports.show = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Chi tiết đơn",
    "route": "GET /staff/orders/:id",
    "tasks": [
      "Chi tiết, khách, địa chỉ, thanh toán, lịch sử; nút Duyệt / Huỷ / Xác nhận thanh toán / Hoàn tất / Xác nhận hoàn tiền tuỳ trạng thái; hiện serial đã gán"
    ],
    "db": "Orders, OrderDetails, OrderDetailSerials, AuditLogs",
    "rubric": "",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/orders/:id/approve
exports.approve = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Duyệt đơn",
    "route": "POST /staff/orders/:id/approve",
    "tasks": [
      "db.exec(\"sp_ApproveOrder\", { OrderId, AccountId: req.session.user.accountId })",
      "Tồn kho giảm, gán serial, tạo bảo hành, phát hành hoá đơn. Bắt lỗi 50030-50033. audit.log"
    ],
    "db": "sp_ApproveOrder",
    "rubric": "A4 duyệt đơn (trừ kho)",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/orders/:id/cancel
exports.cancel = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Huỷ đơn",
    "route": "POST /staff/orders/:id/cancel",
    "tasks": [
      "db.exec(\"sp_CancelOrder\", { OrderId, Reason, AccountId }) → tồn kho được trả lại; nếu đơn đã Paid, PaymentStatus chuyển RefundPending (CHƯA phải Refunded)"
    ],
    "db": "sp_CancelOrder",
    "rubric": "A4 huỷ đơn (trả kho)",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/orders/:id/confirm-payment
exports.confirmPayment = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Xác nhận đã thanh toán (đơn trả trước)",
    "route": "POST /staff/orders/:id/confirm-payment",
    "tasks": [
      "db.exec(\"sp_ConfirmPayment\", { OrderId, AccountId }) - chỉ cho đơn BankTransfer/Card/Installment đang PaymentStatus=Pending"
    ],
    "db": "sp_ConfirmPayment",
    "rubric": "",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/orders/:id/complete
exports.complete = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Xác nhận giao hàng thành công",
    "route": "POST /staff/orders/:id/complete",
    "tasks": [
      "db.exec(\"sp_CompleteOrder\", { OrderId, AccountId }) - đơn COD tự thu tiền lúc giao; đơn trả trước phải Paid từ trước. Tự cộng điểm/nâng hạng thành viên."
    ],
    "db": "sp_CompleteOrder",
    "rubric": "",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/orders/:id/confirm-refund
exports.confirmRefund = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Xác nhận đã hoàn tiền",
    "route": "POST /staff/orders/:id/confirm-refund",
    "tasks": [
      "db.exec(\"sp_ConfirmRefund\", { OrderId, AccountId }) - chỉ gọi SAU KHI đã thực sự chuyển tiền lại cho khách (đơn Cancelled, PaymentStatus=RefundPending)"
    ],
    "db": "sp_ConfirmRefund",
    "rubric": "",
    "controller": "src/controllers/staff/order.controller.js",
    "view": "src/views/staff/..."
  });
};
