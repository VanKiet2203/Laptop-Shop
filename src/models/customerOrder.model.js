// Thành viên 3 - Khách mua hàng
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Orders, OrderDetails, AuditLogs (lịch sử trạng thái), Warranties, sp_CancelOrder
// Hàm chính: listByCustomer(customerId, status), findOwned(orderId, customerId), findByNoAndPhone(orderNo, phone),
//           findAfterPlace(orderId), cancelPending(orderId, accountId, reason)
const db = require('../config/db');

const ORDER_COLUMNS = `o.OrderId, o.OrderNo, o.CustomerId, o.CreatedAt, o.ApprovedAt, o.CompletedAt, o.CancelledAt, o.Status,
            o.ReceiverName, o.ReceiverPhone, o.ReceiverEmail, o.ShippingAddress,
            o.PaymentMethod, o.PaymentStatus,
            o.Subtotal, o.DiscountAmount, o.ShippingFee, o.VatAmount, o.TotalAmount,
            o.Note, o.CancelReason, p.Code AS PromoCode`;

// lịch sử mua hàng của khách, lọc theo trạng thái (Pending, Approved, Completed, Cancelled)
exports.listByCustomer = (customerId, status) => db.query(
  `SELECT o.OrderId, o.OrderNo, o.CreatedAt, o.Status, o.TotalAmount, o.PaymentMethod, o.PaymentStatus,
          (SELECT COUNT(*) FROM dbo.OrderDetails od WHERE od.OrderId = o.OrderId) AS TotalItems,
          (SELECT ISNULL(SUM(od.Quantity), 0) FROM dbo.OrderDetails od WHERE od.OrderId = o.OrderId) AS TotalQty,
          (SELECT TOP 1 img.ImageUrl FROM dbo.OrderDetails od
             LEFT JOIN dbo.ProductImages img ON img.ProductId = od.ProductId AND img.IsPrimary = 1
             WHERE od.OrderId = o.OrderId ORDER BY od.OrderDetailId) AS FirstImage
   FROM dbo.Orders o
   WHERE o.CustomerId = @customerId
     ${status ? 'AND o.Status = @status' : ''}
   ORDER BY o.CreatedAt DESC`,
  { customerId, status }
);

async function withItems(order) {
  if (!order) return null;
  order.items = await db.query(
    `SELECT od.OrderDetailId, od.Quantity, od.UnitPrice, od.LineTotal, od.WarrantyMonths,
            p.ProductName, p.Slug, p.Sku, cat.Slug AS CategorySlug, img.ImageUrl AS PrimaryImage
     FROM dbo.OrderDetails od
     JOIN dbo.Products p ON od.ProductId = p.ProductId
     JOIN dbo.Categories cat ON cat.CategoryId = p.CategoryId
     LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
     WHERE od.OrderId = @orderId
     ORDER BY od.OrderDetailId`,
    { orderId: order.OrderId }
  );
  return order;
}

// lấy toàn bộ thông tin về đơn hàng (Order + OrderDetails + Promotions + Products) của đơn đang chọn + của khách hàng ấy
exports.findOwned = async (orderId, customerId) => withItems(await db.queryOne(
  `SELECT ${ORDER_COLUMNS}
   FROM dbo.Orders o
   LEFT JOIN dbo.Promotions p ON p.PromotionId = o.PromotionId
   WHERE o.OrderId = @orderId AND o.CustomerId = @customerId`,
  { orderId, customerId }
));

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

/**
 * Tra cứu đơn cho khách KHÔNG đăng nhập: phải khớp cả mã đơn VÀ số điện thoại nhận hàng.
 * SĐT so theo chữ số (bỏ khoảng trắng, dấu chấm...) để gõ "0912 345 678" vẫn khớp.
 */
exports.findByNoAndPhone = async (orderNo, phone) => {
  const digits = digitsOnly(phone);
  if (!orderNo || digits.length < 9) return null;
  return withItems(await db.queryOne(
    `SELECT ${ORDER_COLUMNS}
     FROM dbo.Orders o
     LEFT JOIN dbo.Promotions p ON p.PromotionId = o.PromotionId
     WHERE o.OrderNo = @orderNo AND o.ReceiverPhone = @phone`,
    { orderNo: String(orderNo).trim().toUpperCase().replace(/^#/, ''), phone: digits }
  ));
};

/**
 * "Quên mã đơn": các đơn gần đây (180 ngày) khớp CẢ số điện thoại nhận hàng VÀ email đã nhập khi đặt.
 * Kết quả chỉ được gửi vào chính email đó, không hiển thị ra trang (tránh dò mã đơn của người khác).
 */
exports.findCodesByPhoneEmail = (phone, email) => {
  const digits = digitsOnly(phone);
  const mail = String(email || '').trim().toLowerCase();
  if (digits.length < 9 || !mail) return [];
  return db.query(
    `SELECT TOP 10 OrderNo, CreatedAt, Status, TotalAmount, ReceiverPhone
     FROM dbo.Orders
     WHERE ReceiverPhone = @phone AND LOWER(ReceiverEmail) = @email
       AND CreatedAt >= DATEADD(DAY, -180, SYSDATETIME())
     ORDER BY OrderId DESC`,
    { phone: digits, email: mail });
};

/** Đơn vừa đặt xong (trang cảm ơn). Người gọi PHẢI tự kiểm tra quyền xem (đơn nằm trong session của chính khách này). */
exports.findAfterPlace = async (orderId) => withItems(await db.queryOne(
  `SELECT ${ORDER_COLUMNS}
   FROM dbo.Orders o
   LEFT JOIN dbo.Promotions p ON p.PromotionId = o.PromotionId
   WHERE o.OrderId = @orderId`,
  { orderId }
));

// cancel đơn hàng của khách (Pending, hoặc Approved chưa thanh toán) - sp_CancelOrder kiểm tra lại quyền + trạng thái
exports.cancelPending = (orderId, accountId, reason) => db.exec('sp_CancelOrder', { OrderId: orderId, AccountId: accountId, Reason: reason });
// tìm order bằng mã order
exports.findById = (orderId) => db.queryOne('SELECT * FROM dbo.Orders WHERE OrderId = @orderId', { orderId });
