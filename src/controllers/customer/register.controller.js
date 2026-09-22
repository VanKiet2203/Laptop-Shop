// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /register
exports.showRegister = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Đăng ký",
    "route": "GET /register",
    "tasks": [
      "Form đăng ký"
    ],
    "db": "Accounts, Customers",
    "rubric": "A3",
    "controller": "src/controllers/customer/register.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /register
exports.register = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Xử lý đăng ký",
    "route": "POST /register",
    "tasks": [
      "Transaction: INSERT Accounts (role CUSTOMER, bcrypt) + Customers + Carts; SĐT/email/username không được trùng",
      "Đăng nhập luôn sau khi đăng ký (set req.session.user giống auth.controller)"
    ],
    "db": "Accounts, Customers, Carts",
    "rubric": "",
    "controller": "src/controllers/customer/register.controller.js",
    "view": "src/views/customer/..."
  });
};
