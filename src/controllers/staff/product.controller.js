// MODULE 2 - QUẢN LÝ SẢN PHẨM (NV bán hàng)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/products
exports.index = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Danh sách sản phẩm",
    "route": "GET /staff/products",
    "tasks": [
      "Bảng sản phẩm, tìm kiếm, lọc, sắp xếp, phân trang, hiện tồn kho, sản phẩm ẩn"
    ],
    "db": "vw_ProductCatalog",
    "rubric": "A4 thêm xoá sửa sản phẩm",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/products/new
exports.showCreate = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Form thêm sản phẩm",
    "route": "GET /staff/products/new",
    "tasks": [
      "Form: SKU, tên, danh mục, thương hiệu, giá nhập/bán, bảo hành, có quản lý serial, mô tả"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/products
exports.create = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Thêm sản phẩm",
    "route": "POST /staff/products",
    "tasks": [
      "INSERT Products (trigger tự tạo Inventory), slug tự sinh bằng helpers.slugify, kiểm tra SKU trùng, audit.log"
    ],
    "db": "Products, ProductImages",
    "rubric": "A4 thêm",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};

// GET /staff/products/:id/edit
exports.showEdit = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Form sửa sản phẩm",
    "route": "GET /staff/products/:id/edit",
    "tasks": [
      "Nạp sản phẩm + thuộc tính kỹ thuật + ảnh"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/products/:id
exports.update = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Sửa sản phẩm",
    "route": "POST /staff/products/:id",
    "tasks": [
      "UPDATE Products (UpdatedAt = SYSDATETIME()), lưu ProductAttributeValues, ảnh"
    ],
    "db": "",
    "rubric": "A4 sửa",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/products/:id/delete
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Xoá / ẩn sản phẩm",
    "route": "POST /staff/products/:id/delete",
    "tasks": [
      "Đã có trong OrderDetails/GoodsReceiptDetails thì chỉ đặt IsActive = 0; chưa có thì DELETE thật"
    ],
    "db": "",
    "rubric": "A4 xoá",
    "controller": "src/controllers/staff/product.controller.js",
    "view": "src/views/staff/..."
  });
};
