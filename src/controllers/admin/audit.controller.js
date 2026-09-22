// MODULE 1 - ADMIN
// Chủ sở hữu: Thành viên 1 - Hệ thống & Kho
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /admin/audit-logs
exports.index = async (req, res) => {
  todo(res, {
    "module": "M1",
    "owner": "Thành viên 1 - Hệ thống & Kho",
    "title": "Admin - Nhật ký hệ thống",
    "route": "GET /admin/audit-logs",
    "tasks": [
      "Tìm AuditLogs theo khoảng ngày, người thực hiện, hành động; phân trang"
    ],
    "db": "AuditLogs, Accounts",
    "rubric": "",
    "controller": "src/controllers/admin/audit.controller.js",
    "view": "src/views/admin/..."
  });
};
