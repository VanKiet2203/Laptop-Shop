// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Orders, OrderDetails, sp_ApproveOrder, sp_CancelOrder
// Hàm gợi ý: search({status, from, to, q, page}), findById(id), approve(orderId, accountId), cancel(orderId, reason, accountId)
const db = require('../config/db');

// exports.example = () => db.query('SELECT ...', { param: value });

module.exports = {};
