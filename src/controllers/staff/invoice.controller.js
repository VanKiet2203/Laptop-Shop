// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/invoices
exports.index = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Hoá đơn bán hàng",
    "route": "GET /staff/invoices",
    "tasks": [
      "Xem hoá đơn theo khoảng thời gian tuỳ chọn (from, to), tổng hợp số tiền"
    ],
    "db": "Invoices",
    "rubric": "A4 xem hoá đơn trong thời điểm tuỳ chọn",
    "controller": "src/controllers/staff/invoice.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/invoices/:id
exports.show = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Chi tiết hoá đơn",
    "route": "GET /staff/invoices/:id",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/invoice.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/invoices/:id/print
exports.print = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - In hoá đơn",
    "route": "GET /staff/invoices/:id/print",
    "tasks": [
      "View riêng (layout:false) khổ A5/A4, danh sách serial từng máy, tăng Invoices.PrintCount"
    ],
    "db": "Invoices, OrderDetails, OrderDetailSerials",
    "rubric": "A4 in hoá đơn, lưu trữ",
    "controller": "src/controllers/staff/invoice.controller.js",
    "view": "src/views/staff/..."
  });
};
