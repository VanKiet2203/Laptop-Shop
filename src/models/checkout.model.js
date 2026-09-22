// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: sp_PlaceOrderFromCart, Promotions
// Hàm gợi ý: previewPromo(code, subtotal), placeOrder({customerId, addressId, paymentMethod, promoCode, note}) -> orderId
const db = require('../config/db');

// exports.example = () => db.query('SELECT ...', { param: value });

module.exports = {};
