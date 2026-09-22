// MODULE 1 - KHO (nhập hàng)
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /warehouse/
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Tổng quan",
    "route": "GET /warehouse/",
    "tasks": [
      "Thẻ thống kê: tổng SKU, tổng tồn, phiếu nhập tháng này",
      "Bảng cảnh báo sắp hết hàng từ view vw_LowStock",
      "Phiếu nhập gần đây"
    ],
    "db": "vw_LowStock, GoodsReceipts",
    "rubric": "",
    "controller": "src/controllers/warehouse/dashboard.controller.js",
    "view": "src/views/warehouse/..."
  });
};
