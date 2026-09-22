// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /account
exports.profile = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Hồ sơ",
    "route": "GET /account",
    "tasks": [
      "Xem/sửa thông tin cá nhân, hạng thân thiết + điểm (MembershipTiers)"
    ],
    "db": "Customers, MembershipTiers",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /account
exports.updateProfile = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Cập nhật hồ sơ",
    "route": "POST /account",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};

// GET /account/addresses
exports.addresses = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Sổ địa chỉ",
    "route": "GET /account/addresses",
    "tasks": [
      "Danh sách địa chỉ giao hàng"
    ],
    "db": "CustomerAddresses",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /account/addresses
exports.addAddress = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Thêm địa chỉ",
    "route": "POST /account/addresses",
    "tasks": [
      "Nếu IsDefault=1 phải bỏ mặc định các địa chỉ khác (có unique index)"
    ],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /account/addresses/:id/delete
exports.deleteAddress = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Xoá địa chỉ",
    "route": "POST /account/addresses/:id/delete",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /account/addresses/:id/default
exports.setDefault = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Đặt địa chỉ mặc định",
    "route": "POST /account/addresses/:id/default",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/account.controller.js",
    "view": "src/views/customer/..."
  });
};
