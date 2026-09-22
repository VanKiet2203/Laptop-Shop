// MODULE 2 - QUẢN LÝ SẢN PHẨM (NV bán hàng)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/attributes
exports.index = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Thuộc tính kỹ thuật",
    "route": "GET /staff/attributes",
    "tasks": [
      "CRUD bảng Attributes (mã, tên, đơn vị, cho phép lọc)"
    ],
    "db": "Attributes",
    "rubric": "",
    "controller": "src/controllers/staff/attribute.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/attributes
exports.create = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Thêm thuộc tính",
    "route": "POST /staff/attributes",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/attribute.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/attributes/:id/delete
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Xoá thuộc tính",
    "route": "POST /staff/attributes/:id/delete",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/attribute.controller.js",
    "view": "src/views/staff/..."
  });
};
