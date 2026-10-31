// Model khuyến mãi (chỉ phần đọc cho cửa hàng). Áp mã khi đặt hàng nằm trong sp_PlaceOrder.
const db = require('../config/db');

/**
 * Mã đang chạy (còn hạn, còn lượt) để hiện trên trang chủ / bước thanh toán.
 * Truyền `subtotal` (tiền hàng của đơn) thì chỉ trả các mã mà đơn đó đủ điều kiện (MinOrderAmount <= subtotal).
 */
exports.active = (limit = 4, subtotal = null) => db.query(
  `SELECT TOP (@limit) Code, PromoName, DiscountType, DiscountValue, MinOrderAmount, MaxDiscount, EndDate
   FROM dbo.Promotions
   WHERE IsActive = 1 AND SYSDATETIME() BETWEEN StartDate AND EndDate
     AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
     AND (@subtotal IS NULL OR MinOrderAmount <= @subtotal)
   ORDER BY EndDate`,
  { limit, subtotal });
