// MODULE 1 - ADMIN
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /admin/users
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Danh sách người dùng",
    "route": "GET /admin/users",
    "tasks": [
      "Truy vấn Accounts JOIN Roles (LEFT JOIN Employees/Customers): tìm theo username/họ tên, lọc theo vai trò, phân trang",
      "Hiện trạng thái Hoạt động / Khoá, lần đăng nhập cuối"
    ],
    "db": "Accounts, Roles, Employees, Customers",
    "rubric": "II.2 Admin quản lý user",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// GET /admin/users/new
exports.showCreate = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Form thêm người dùng",
    "route": "GET /admin/users/new",
    "tasks": [
      "Form: username, email, mật khẩu, vai trò, họ tên, SĐT (nhân viên)"
    ],
    "db": "Roles",
    "rubric": "II.2",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/users
exports.create = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Thêm người dùng",
    "route": "POST /admin/users",
    "tasks": [
      "Transaction: INSERT Accounts (bcrypt hash) + INSERT Employees nếu vai trò nhân viên",
      "Kiểm tra trùng username/email, ghi audit.log"
    ],
    "db": "Accounts, Employees",
    "rubric": "II.2 thêm",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// GET /admin/users/:id/edit
exports.showEdit = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Form sửa người dùng",
    "route": "GET /admin/users/:id/edit",
    "tasks": [
      "Nạp thông tin tài khoản + hồ sơ nhân viên"
    ],
    "db": "",
    "rubric": "II.2 sửa",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/users/:id
exports.update = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Cập nhật người dùng",
    "route": "POST /admin/users/:id",
    "tasks": [
      "UPDATE Accounts/Employees, đổi vai trò (= phân quyền)",
      "Không cho tự hạ quyền chính mình"
    ],
    "db": "",
    "rubric": "II.2 sửa + phân quyền",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/users/:id/toggle
exports.toggleActive = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Khoá / mở khoá tài khoản",
    "route": "POST /admin/users/:id/toggle",
    "tasks": [
      "Đảo Accounts.IsActive"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Đặt lại mật khẩu",
    "route": "POST /admin/users/:id/reset-password",
    "tasks": [
      "Sinh mật khẩu tạm hoặc nhận mật khẩu mới, bcrypt.hash rồi UPDATE"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};

// POST /admin/users/:id/delete
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Xoá người dùng",
    "route": "POST /admin/users/:id/delete",
    "tasks": [
      "Xoá nếu chưa phát sinh dữ liệu; nếu có ràng buộc FK (lỗi 547) thì chuyển sang khoá tài khoản"
    ],
    "db": "",
    "rubric": "II.2 xoá",
    "controller": "src/controllers/admin/user.controller.js",
    "view": "src/views/admin/..."
  });
};
