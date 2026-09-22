// Thành viên 1 - Hệ thống & Kho
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: GoodsReceipts, GoodsReceiptDetails, ProductSerials, sp_PostGoodsReceipt
// Hàm gợi ý: search({month, year, supplierId}), findById(), createDraft(header, lines, serials), post(id), cancel(id), monthlyTotals(year)
const db = require('../config/db');

// exports.example = () => db.query('SELECT ...', { param: value });

module.exports = {};
