// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /checkout
exports.show = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Thanh toán",
    "route": "GET /checkout",
    "tasks": [
      "Chọn địa chỉ giao, phương thức thanh toán (COD/BankTransfer/Card/Installment), nhập voucher, xem tóm tắt (tiền hàng, giảm giá, ship, VAT)"
    ],
    "db": "CustomerAddresses, Promotions",
    "rubric": "A3",
    "controller": "src/controllers/customer/checkout.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /checkout/promo
exports.checkPromo = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Kiểm tra voucher",
    "route": "POST /checkout/promo",
    "tasks": [
      "Tính trước số tiền giảm (không tăng UsedCount) — logic phải giống sp_PlaceOrderFromCart"
    ],
    "db": "Promotions",
    "rubric": "",
    "controller": "src/controllers/customer/checkout.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /checkout
exports.place = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Đặt hàng",
    "route": "POST /checkout",
    "tasks": [
      "db.exec(\"sp_PlaceOrderFromCart\", { CustomerId, AddressId, PaymentMethod, PromoCode, Note }, { OrderId: db.sql.Int })",
      "Bắt lỗi nghiệp vụ 50020-50024 (giỏ trống, thiếu tồn, voucher sai...), chuyển tới /orders/:id"
    ],
    "db": "sp_PlaceOrderFromCart",
    "rubric": "A3 mua hàng",
    "controller": "src/controllers/customer/checkout.controller.js",
    "view": "src/views/customer/..."
  });
};
