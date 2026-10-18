// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Orders, OrderDetails, AuditLogs (lịch sử trạng thái), Warranties, sp_CancelOrder
// Hàm gợi ý: listByCustomer(customerId, status), findOwned(orderId, customerId), cancelPending(orderId, accountId, reason)
const db = require('../config/db');


// lịch sử mua hàng của khách, lọc theo trạng thái (Pending, Approved, Shipped, Delivered, Cancelled)
exports.listByCustomer = (customerId, status) => db.query(
  `SELECT o.OrderId, o.OrderNo, o.CreatedAt, o.Status, o.TotalAmount, o.PaymentMethod, o.PaymentStatus,
          (SELECT COUNT(*) FROM dbo.OrderDetails od WHERE od.OrderId = o.OrderId) AS TotalItems
   FROM dbo.Orders o
   WHERE o.CustomerId = @customerId
     ${status ? 'AND o.Status = @status' : ''}
   ORDER BY o.CreatedAt DESC`,
  { customerId, status }
);
// lấy toàn bộ thông tin về đơn hàng (Order +  OrderDetails+ Promotions + Products ) của của đơn hàng đang chọn + của khách hàng ấy 
exports.findOwned = async (orderId, customerId) => {
  // BƯỚC 1: Lấy "Vỏ" (Thông tin chung của đơn hàng)
  const order = await db.queryOne(
    `SELECT o.OrderId, o.OrderNo, o.CreatedAt, o.Status,
            o.ReceiverName, o.ReceiverPhone, o.ShippingAddress,
            o.PaymentMethod, o.PaymentStatus,
            o.Subtotal, o.DiscountAmount, o.ShippingFee, o.VatAmount, o.TotalAmount,
            o.Note, o.CancelReason, p.Code AS PromoCode
     FROM dbo.Orders o
     LEFT JOIN dbo.Promotions p ON p.PromotionId = o.PromotionId
     WHERE o.OrderId = @orderId AND o.CustomerId = @customerId`,
    { orderId, customerId }
  );

  // Nếu không tìm thấy đơn (hoặc không phải của khách này) thì dừng luôn
  if (!order) return null;

  // BƯỚC 2: Lấy chi tiết sản phảm (Danh sách các món hàng từ OrderDetails JOIN Products)
  const items = await db.query(
    `SELECT od.OrderDetailId, od.Quantity, od.UnitPrice, od.LineTotal, od.WarrantyMonths,
            p.ProductName, p.Slug, img.ImageUrl AS PrimaryImage
     FROM dbo.OrderDetails od
     JOIN dbo.Products p ON od.ProductId = p.ProductId
     LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
     WHERE od.OrderId = @orderId`,
    { orderId }
  );

  order.items = items;
  return order;
};
// cancel đơn hàng đang Pending (chưa duyệt) của khách hàng, gọi procedure sp_CancelOrder
exports.cancelPending = (orderId, accountId, reason) => db.exec('sp_CancelOrder', { OrderId: orderId, AccountId: accountId, Reason: reason }); 
// tìm order bằng mã order
exports.findById = (orderId) => db.queryOne('SELECT * FROM dbo.Orders WHERE OrderId = @orderId', { orderId });

