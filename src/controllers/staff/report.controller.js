// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/reports
exports.index = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Thống kê doanh thu",
    "route": "GET /staff/reports",
    "tasks": [
      "Doanh thu theo ngày/tháng/năm (bộ lọc from/to + group), biểu đồ (Chart.js CDN), tổng đơn, giảm giá, VAT",
      "Gợi ý dùng view vw_SalesDaily, GROUP BY YEAR/MONTH"
    ],
    "db": "vw_SalesDaily",
    "rubric": "A4 xem thống kê, báo cáo bán hàng",
    "controller": "src/controllers/staff/report.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/reports/products
exports.products = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Sản phẩm bán chạy & lợi nhuận",
    "route": "GET /staff/reports/products",
    "tasks": [
      "vw_ProductSales: SL bán, doanh số, lợi nhuận gộp; sản phẩm tồn đọng"
    ],
    "db": "vw_ProductSales",
    "rubric": "",
    "controller": "src/controllers/staff/report.controller.js",
    "view": "src/views/staff/..."
  });
};
