// MODULE 2 - QUẢN LÝ SẢN PHẨM (NV bán hàng)
// Chủ sở hữu: Thành viên 2 - Danh mục sản phẩm
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/categories
exports.index = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Danh mục",
    "route": "GET /staff/categories",
    "tasks": [
      "Hiển thị cây danh mục (ParentId)"
    ],
    "db": "Categories",
    "rubric": "",
    "controller": "src/controllers/staff/category.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/categories
exports.create = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Thêm danh mục",
    "route": "POST /staff/categories",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/category.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/categories/:id
exports.update = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Sửa danh mục",
    "route": "POST /staff/categories/:id",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/category.controller.js",
    "view": "src/views/staff/..."
  });
};

// POST /staff/categories/:id/delete
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M2",
    "owner": "Thành viên 2 - Danh mục sản phẩm",
    "title": "NV - Xoá danh mục",
    "route": "POST /staff/categories/:id/delete",
    "tasks": [
      "Không xoá nếu còn sản phẩm hoặc danh mục con"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/staff/category.controller.js",
    "view": "src/views/staff/..."
  });
};
