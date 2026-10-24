// MODULE 4 - QUẢN LÝ ĐƠN HÀNG
// Model chứa câu lệnh SQL của chức năng đơn hàng.
// Không sửa cấu hình database dùng chung.

const db = require('../config/db');

// Tìm kiếm và phân trang đơn hàng
exports.search = async ({
  status,
  from,
  to,
  q,
  page = 1,
  pageSize = 10
} = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const filters = [];

  const params = {
    offset: (currentPage - 1) * pageSize,
    pageSize
  };

  if (status) {
    filters.push('o.Status = @status');
    params.status = status;
  }

  if (from) {
    filters.push('o.CreatedAt >= @from');
    params.from = from;
  }

  if (to) {
    filters.push(
      'o.CreatedAt < DATEADD(DAY, 1, CAST(@to AS DATE))'
    );
    params.to = to;
  }

  if (q) {
    filters.push(
      '(o.OrderNo LIKE @q OR c.FullName LIKE @q OR c.Phone LIKE @q)'
    );
    params.q = `%${q}%`;
  }

  const where = filters.length
    ? `WHERE ${filters.join(' AND ')}`
    : '';

  const rows = await db.query(
    `SELECT
       o.OrderId,
       o.OrderNo,
       o.Status,
       o.PaymentMethod,
       o.PaymentStatus,
       o.TotalAmount,
       o.CreatedAt,
       c.FullName AS CustomerName,
       c.Phone AS CustomerPhone
     FROM dbo.Orders o
     LEFT JOIN dbo.Customers c
       ON c.CustomerId = o.CustomerId
     ${where}
     ORDER BY o.CreatedAt DESC
     OFFSET @offset ROWS
     FETCH NEXT @pageSize ROWS ONLY`,
    params
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS Total
     FROM dbo.Orders o
     LEFT JOIN dbo.Customers c
       ON c.CustomerId = o.CustomerId
     ${where}`,
    params
  );

  return {
    rows,
    total: countRows[0]?.Total || 0,
    page: currentPage,
    pageSize
  };
};

// Lấy thông tin chi tiết đơn hàng
exports.findById = async (orderId) => {
  const order = await db.queryOne(
    `SELECT
       o.*,
       c.FullName AS CustomerName,
       c.Phone AS CustomerPhone,
       c.Email AS CustomerEmail
     FROM dbo.Orders o
     LEFT JOIN dbo.Customers c
       ON c.CustomerId = o.CustomerId
     WHERE o.OrderId = @orderId`,
    { orderId }
  );

  if (!order) {
    return null;
  }

  // Lấy danh sách sản phẩm và serial trong đơn hàng
  order.details = await db.query(
    `SELECT
       od.OrderDetailId,
       od.ProductId,
       p.ProductName,
       p.Sku,
       od.Quantity,
       od.UnitPrice,
       od.CostPrice,
       od.WarrantyMonths,
       od.LineTotal,
       STRING_AGG(ps.SerialNumber, ', ') AS SerialNumbers
     FROM dbo.OrderDetails od
     LEFT JOIN dbo.Products p
       ON p.ProductId = od.ProductId
     LEFT JOIN dbo.OrderDetailSerials ods
       ON ods.OrderDetailId = od.OrderDetailId
     LEFT JOIN dbo.ProductSerials ps
       ON ps.SerialId = ods.SerialId
     WHERE od.OrderId = @orderId
     GROUP BY
       od.OrderDetailId,
       od.ProductId,
       p.ProductName,
       p.Sku,
       od.Quantity,
       od.UnitPrice,
       od.CostPrice,
       od.WarrantyMonths,
       od.LineTotal`,
    { orderId }
  );

  return order;
};

// Duyệt đơn hàng
exports.approve = (orderId, accountId) => {
  return db.exec('sp_ApproveOrder', {
    OrderId: orderId,
    AccountId: accountId
  });
};

// Hủy đơn hàng
exports.cancel = (orderId, reason, accountId) => {
  return db.exec('sp_CancelOrder', {
    OrderId: orderId,
    Reason: reason,
    AccountId: accountId
  });
};

// Xác nhận thanh toán
exports.confirmPayment = (orderId, accountId) => {
  return db.exec('sp_ConfirmPayment', {
    OrderId: orderId,
    AccountId: accountId
  });
};

// Hoàn tất đơn hàng
exports.complete = (orderId, accountId) => {
  return db.exec('sp_CompleteOrder', {
    OrderId: orderId,
    AccountId: accountId
  });
};

// Xác nhận hoàn tiền
exports.confirmRefund = (orderId, accountId) => {
  return db.exec('sp_ConfirmRefund', {
    OrderId: orderId,
    AccountId: accountId
  });
};