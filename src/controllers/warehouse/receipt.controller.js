// MODULE 1 - KHO (nhập hàng)
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /warehouse/receipts
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Lịch sử phiếu nhập",
    "route": "GET /warehouse/receipts",
    "tasks": [
      "Lọc theo tháng/năm, NCC, trạng thái; thống kê tổng tiền nhập theo tháng/năm"
    ],
    "db": "GoodsReceipts, GoodsReceiptDetails",
    "rubric": "B4 xem & thống kê lịch sử nhập kho theo tháng/năm",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/receipts/new
exports.showCreate = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Lập phiếu nhập",
    "route": "GET /warehouse/receipts/new",
    "tasks": [
      "Chọn NCC, thêm dòng sản phẩm (SL, đơn giá)",
      "Sản phẩm IsSerialTracked=1: ô nhập từng Serial (số lượng serial = số lượng nhập)"
    ],
    "db": "Suppliers, Products",
    "rubric": "B3 lập phiếu nhập kho",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/receipts
exports.create = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Lưu phiếu nhập",
    "route": "POST /warehouse/receipts",
    "tasks": [
      "Dùng db.transaction: INSERT GoodsReceipts (Draft, số phiếu từ sq_ReceiptNo) → GoodsReceiptDetails → ProductSerials (Pending)",
      "Kiểm tra serial trùng (UNIQUE) và báo lỗi thân thiện"
    ],
    "db": "GoodsReceipts, GoodsReceiptDetails, ProductSerials, sq_ReceiptNo",
    "rubric": "",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/receipts/:id
exports.show = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Chi tiết phiếu nhập",
    "route": "GET /warehouse/receipts/:id",
    "tasks": [
      "Hiển thị phiếu, chi tiết, danh sách serial"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/receipts/:id/post
exports.post = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Chốt phiếu nhập",
    "route": "POST /warehouse/receipts/:id/post",
    "tasks": [
      "db.exec(\"sp_PostGoodsReceipt\", { ReceiptId })  → tồn kho tăng, serial thành InStock",
      "Bắt lỗi nghiệp vụ 50040-50043"
    ],
    "db": "sp_PostGoodsReceipt",
    "rubric": "Nhập kho: số lượng tăng",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/receipts/:id/cancel
exports.cancel = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Huỷ phiếu nháp",
    "route": "POST /warehouse/receipts/:id/cancel",
    "tasks": [
      "Chỉ huỷ khi Draft: UPDATE Status=Cancelled, xoá serial Pending"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/receipts/:id/print
exports.print = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - In phiếu nhập",
    "route": "GET /warehouse/receipts/:id/print",
    "tasks": [
      "Render view in (layout:false) để in / lưu PDF từ trình duyệt"
    ],
    "db": "",
    "rubric": "B4 in và lưu trữ phiếu nhập",
    "controller": "src/controllers/warehouse/receipt.controller.js",
    "view": "src/views/warehouse/..."
  });
};
