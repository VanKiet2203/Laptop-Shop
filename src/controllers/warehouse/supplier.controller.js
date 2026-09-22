// MODULE 1 - KHO (nhập hàng)
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /warehouse/suppliers
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Nhà cung cấp",
    "route": "GET /warehouse/suppliers",
    "tasks": [
      "Tìm kiếm, sắp xếp theo tên/mã số thuế/công nợ",
      "Có thể hiện công nợ từ view vw_SupplierPayables"
    ],
    "db": "Suppliers, vw_SupplierPayables",
    "rubric": "B4 tìm kiếm, sắp xếp theo NCC",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/suppliers/new
exports.showCreate = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Form thêm NCC",
    "route": "GET /warehouse/suppliers/new",
    "tasks": [
      "Form các trường Suppliers"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/suppliers
exports.create = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Thêm NCC",
    "route": "POST /warehouse/suppliers",
    "tasks": [
      "INSERT Suppliers, kiểm tra trùng MST"
    ],
    "db": "",
    "rubric": "B4 thêm",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// GET /warehouse/suppliers/:id/edit
exports.showEdit = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Form sửa NCC",
    "route": "GET /warehouse/suppliers/:id/edit",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/suppliers/:id
exports.update = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Sửa NCC",
    "route": "POST /warehouse/suppliers/:id",
    "tasks": [],
    "db": "",
    "rubric": "B4 sửa",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};

// POST /warehouse/suppliers/:id/delete
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Kho - Xoá NCC",
    "route": "POST /warehouse/suppliers/:id/delete",
    "tasks": [
      "Nếu đã có phiếu nhập thì chỉ đặt IsActive = 0"
    ],
    "db": "",
    "rubric": "B4 xoá",
    "controller": "src/controllers/warehouse/supplier.controller.js",
    "view": "src/views/warehouse/..."
  });
};
