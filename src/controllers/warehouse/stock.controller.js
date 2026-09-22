// MODULE 1 - KHO (nhập hàng)
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /warehouse/stock
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Tồn kho",
    "route": "GET /warehouse/stock",
    "tasks": [
      "Xem thông tin hàng hoá + số lượng (QtyOnHand/QtyReserved/QtyAvailable) từ vw_ProductCatalog",
      "Tìm kiếm theo tên/SKU, lọc theo giá bán, sắp xếp"
    ],
    "db": "vw_ProductCatalog",
    "rubric": "B3 xem, tìm kiếm, lọc theo giá/tên",
    "controller": "src/controllers/warehouse/stock.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/stock/serials
exports.serials = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Tra cứu Serial",
    "route": "GET /warehouse/stock/serials",
    "tasks": [
      "Tìm ProductSerials theo serial/IMEI/sản phẩm/trạng thái; hiện lịch sử (phiếu nhập, đơn hàng, bảo hành)"
    ],
    "db": "ProductSerials, OrderDetailSerials, Warranties",
    "rubric": "",
    "controller": "src/controllers/warehouse/stock.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/stock/movements
exports.movements = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Sổ kho (xuất nhập tồn)",
    "route": "GET /warehouse/stock/movements",
    "tasks": [
      "Truy vấn StockMovements theo sản phẩm + khoảng ngày"
    ],
    "db": "StockMovements",
    "rubric": "",
    "controller": "src/controllers/warehouse/stock.controller.js",
    "view": "src/views/warehouse/..."
  });
};
