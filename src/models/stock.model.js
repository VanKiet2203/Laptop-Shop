// Thành viên 1 - Hệ thống & Kho
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: vw_ProductCatalog, ProductSerials, StockMovements, vw_LowStock
// Hàm gợi ý: listStock({q, minPrice, maxPrice, sort}), lowStock(), searchSerials({q, status}), movements({productId, from, to})
const db = require('../config/db');

// exports.example = () => db.query('SELECT ...', { param: value });

module.exports = {};
