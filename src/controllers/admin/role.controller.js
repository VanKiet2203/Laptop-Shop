// MODULE 1 - ADMIN
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /admin/roles
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Vai trò",
    "route": "GET /admin/roles",
    "tasks": [
      "Liệt kê Roles kèm số tài khoản và số quyền"
    ],
    "db": "Roles, RolePermissions, Accounts",
    "rubric": "",
    "controller": "src/controllers/admin/role.controller.js",
    "view": "src/views/admin/..."
  });
};

// GET /admin/roles/:id/permissions
exports.showPermissions = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Ma trận phân quyền",
    "route": "GET /admin/roles/:id/permissions",
    "tasks": [
      "Hiển thị toàn bộ Permissions nhóm theo ModuleName, tick những quyền vai trò đang có"
    ],
    "db": "Permissions, RolePermissions",
    "rubric": "II.2 phân quyền",
    "controller": "src/controllers/admin/role.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/roles/:id/permissions
exports.savePermissions = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Lưu phân quyền",
    "route": "POST /admin/roles/:id/permissions",
    "tasks": [
      "Transaction: DELETE + INSERT RolePermissions theo danh sách tick",
      "Lưu ý: quyền được nạp vào session lúc đăng nhập, cần đăng nhập lại để có hiệu lực"
    ],
    "db": "",
    "rubric": "II.2 phân quyền",
    "controller": "src/controllers/admin/role.controller.js",
    "view": "src/views/admin/..."
  });
};
