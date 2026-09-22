// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /staff/warranty
exports.lookup = async (req, res) => {
  todo(res, {
    "module": "M4",
    "owner": "Thành viên 4 - Đơn hàng, hoá đơn, báo cáo",
    "title": "NV - Tra cứu bảo hành",
    "route": "GET /staff/warranty",
    "tasks": [
      "Nhập serial hoặc SĐT khách → hiện máy, ngày mua, các linh kiện kèm ngày hết hạn bảo hành"
    ],
    "db": "Warranties, ProductSerials, Customers",
    "rubric": "",
    "controller": "src/controllers/staff/warranty.controller.js",
    "view": "src/views/staff/..."
  });
};
