// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/
exports.index = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV bán hàng - Tổng quan",
    "route": "GET /staff/",
    "tasks": [
      "Thẻ: đơn chờ duyệt, doanh thu hôm nay/tháng, sản phẩm sắp hết (vw_LowStock)"
    ],
    "db": "Orders, vw_SalesDaily, vw_LowStock",
    "rubric": "",
    "controller": "src/controllers/staff/dashboard.controller.js",
    "view": "src/views/staff/..."
  });
};
