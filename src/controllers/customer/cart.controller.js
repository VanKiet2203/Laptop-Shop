// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const { todo } = require('../../core/todo');
// const Model = require('../../models/...model');

// GET /cart
exports.show = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Giỏ hàng",
    "route": "GET /cart",
    "tasks": [
      "Hiển thị CartItems JOIN Products, tổng tiền, cảnh báo vượt tồn (QtyAvailable)"
    ],
    "db": "Carts, CartItems, vw_ProductCatalog",
    "rubric": "A3 thực hiện chức năng mua hàng",
    "controller": "src/controllers/customer/cart.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /cart/add
exports.add = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Thêm vào giỏ",
    "route": "POST /cart/add",
    "tasks": [
      "Tạo Carts nếu chưa có; cộng dồn số lượng (CartItems PK cartId+productId); kiểm tra tồn",
      "Nâng cao: kiểm tra tương thích laptop ↔ RAM/SSD bằng CompatibilityRules + ProductAttributeValues",
      "Cập nhật req.session.cartCount"
    ],
    "db": "CartItems, CompatibilityRules",
    "rubric": "",
    "controller": "src/controllers/customer/cart.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /cart/update
exports.update = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Sửa số lượng",
    "route": "POST /cart/update",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/cart.controller.js",
    "view": "src/views/customer/..."
  });
};

// POST /cart/remove/:productId
exports.remove = async (req, res) => {
  todo(res, {
    "module": "M3",
    "owner": "Thành viên 3 - Khách mua hàng",
    "title": "Khách - Bỏ khỏi giỏ",
    "route": "POST /cart/remove/:productId",
    "tasks": [],
    "db": "",
    "rubric": "",
    "controller": "src/controllers/customer/cart.controller.js",
    "view": "src/views/customer/..."
  });
};
