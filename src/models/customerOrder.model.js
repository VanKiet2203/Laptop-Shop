// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Orders, OrderDetails, OrderStatusHistory, Warranties, sp_CancelOrder
// Hàm gợi ý: listByCustomer(customerId, status), findOwned(orderId, customerId), cancelPending(orderId, accountId, reason)
const db = require('../config/db');

// exports.example = () => db.query('SELECT ...', { param: value });

module.exports = {};
