// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /orders
exports.index = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Đơn hàng của tôi",
    "route": "GET /orders",
    "tasks": [
      "Danh sách Orders của khách, lọc theo trạng thái"
    ],
    "db": "Orders",
    "rubric": "Lịch sử mua hàng",
    "controller": "src/controllers/customer/order.controller.js",
    "view": "src/views/customer/..."
  });
};

// GET /orders/:id
exports.show = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Chi tiết đơn",
    "route": "GET /orders/:id",
    "tasks": [
      "Chi tiết + lịch sử trạng thái (OrderStatusHistory) + serial & bảo hành nếu đã duyệt; chỉ xem đơn của chính mình"
    ],
    "db": "Orders, OrderDetails, OrderStatusHistory, Warranties",
    "rubric": "",
    "controller": "src/controllers/customer/order.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /orders/:id/cancel
exports.cancel = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Huỷ đơn chờ duyệt",
    "route": "POST /orders/:id/cancel",
    "tasks": [
      "Chỉ khi Pending; db.exec(\"sp_CancelOrder\", { OrderId, Reason, AccountId })"
    ],
    "db": "sp_CancelOrder",
    "rubric": "",
    "controller": "src/controllers/customer/order.controller.js",
    "view": "src/views/customer/..."
  });
};
