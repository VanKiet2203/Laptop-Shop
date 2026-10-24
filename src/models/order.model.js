// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Orders, OrderDetails, OrderDetailSerials, sp_ApproveOrder, sp_CancelOrder,
//                                sp_ConfirmPayment, sp_CompleteOrder, sp_ConfirmRefund
// Hàm chính: search({status, payStatus, from, to, q, page}), counts(), findById(id), history(id),
//           approve / cancel / confirmPayment / complete / confirmRefund (đều gọi stored procedure)
const db = require('../config/db');
const { paginate } = require('../core/helpers');

const PAGE_SIZE = 15;
const STATUSES = ['Pending', 'Approved', 'Completed', 'Cancelled'];
const PAY_STATUSES = ['Pending', 'Paid', 'RefundPending', 'Refunded'];

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
const validDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s)) ? s : null);

/** Chuẩn hoá bộ lọc từ query string (không tin dữ liệu từ client). */
exports.normalizeFilters = (query = {}) => ({
  status: STATUSES.includes(query.status) ? query.status : '',
  payStatus: PAY_STATUSES.includes(query.payStatus) ? query.payStatus : '',
  from: validDate(query.from) || '',
  to: validDate(query.to) || '',
  q: typeof query.q === 'string' ? query.q.trim().slice(0, 60) : '',
});

exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const q = f.q.replace(/^#/, '');
  const phoneDigits = digitsOnly(q);
  const where = `
    WHERE (@status = '' OR o.Status = @status)
      AND (@payStatus = '' OR o.PaymentStatus = @payStatus)
      AND (@from = '' OR o.CreatedAt >= @from)
      AND (@to = '' OR o.CreatedAt < DATEADD(DAY, 1, CAST(@to AS DATE)))
      AND (@q = '' OR o.OrderNo LIKE '%' + @q + '%'
           OR o.ReceiverName LIKE '%' + @q + '%'
           OR (@phone <> '' AND o.ReceiverPhone LIKE '%' + @phone + '%'))`;
  const params = { status: f.status, payStatus: f.payStatus, from: f.from, to: f.to, q, phone: phoneDigits.length >= 3 ? phoneDigits : '' };
  const total = (await db.queryOne(`SELECT COUNT(*) AS n FROM dbo.Orders o ${where}`, params)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT o.OrderId, o.OrderNo, o.CreatedAt, o.Status, o.PaymentMethod, o.PaymentStatus, o.TotalAmount,
            o.ReceiverName, o.ReceiverPhone, o.CustomerId,
            (SELECT ISNULL(SUM(od.Quantity), 0) FROM dbo.OrderDetails od WHERE od.OrderId = o.OrderId) AS TotalQty
     FROM dbo.Orders o ${where}
     ORDER BY CASE o.Status WHEN 'Pending' THEN 0 ELSE 1 END, o.OrderId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...params, offset: pg.offset, size: pg.pageSize }
  );
  return { rows, pg, filters: f };
};

/** Số đơn theo trạng thái để hiện trên các tab lọc nhanh. */
exports.counts = async () => {
  const rows = await db.query(
    `SELECT Status, COUNT(*) AS n FROM dbo.Orders GROUP BY Status
     UNION ALL SELECT 'RefundPending', COUNT(*) FROM dbo.Orders WHERE PaymentStatus = 'RefundPending'`);
  const out = { Pending: 0, Approved: 0, Completed: 0, Cancelled: 0, RefundPending: 0, all: 0 };
  rows.forEach((r) => { out[r.Status] = r.n; if (STATUSES.includes(r.Status)) out.all += r.n; });
  return out;
};

exports.findById = async (orderId) => {
  const order = await db.queryOne(
    `SELECT o.OrderId, o.OrderNo, o.CustomerId, o.CreatedAt, o.ApprovedAt, o.CompletedAt, o.CancelledAt, o.PaidAt,
            o.Status, o.ReceiverName, o.ReceiverPhone, o.ReceiverEmail, o.ShippingAddress,
            o.PaymentMethod, o.PaymentStatus, o.Subtotal, o.DiscountAmount, o.ShippingFee, o.VatAmount, o.TotalAmount,
            o.Note, o.CancelReason, pr.Code AS PromoCode,
            c.AccountId AS CustomerAccountId, e.FullName AS SalesEmployeeName,
            (SELECT InvoiceNo FROM dbo.Invoices i WHERE i.OrderId = o.OrderId AND i.Status <> 'Voided') AS InvoiceNo
     FROM dbo.Orders o
     LEFT JOIN dbo.Promotions pr ON pr.PromotionId = o.PromotionId
     LEFT JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
     LEFT JOIN dbo.Employees e ON e.EmployeeId = o.SalesEmployeeId
     WHERE o.OrderId = @orderId`,
    { orderId }
  );
  if (!order) return null;
  order.items = await db.query(
    `SELECT od.OrderDetailId, od.Quantity, od.UnitPrice, od.LineTotal, od.WarrantyMonths,
            p.ProductName, p.Sku, p.QtyOnHand, p.QtyReserved, p.IsSerialTracked,
            img.ImageUrl AS PrimaryImage,
            STUFF((SELECT ', ' + s.SerialNumber FROM dbo.OrderDetailSerials ods
                   JOIN dbo.ProductSerials s ON s.SerialId = ods.SerialId
                   WHERE ods.OrderDetailId = od.OrderDetailId ORDER BY s.SerialId
                   FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Serials
     FROM dbo.OrderDetails od
     JOIN dbo.Products p ON p.ProductId = od.ProductId
     LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1
     WHERE od.OrderId = @orderId
     ORDER BY od.OrderDetailId`,
    { orderId }
  );
  return order;
};

/** Lịch sử thao tác trên đơn (AuditLogs do stored procedure ghi). */
exports.history = (orderId) => db.query(
  `SELECT l.CreatedAt, l.Action, l.Detail, ISNULL(e.FullName, N'Hệ thống') AS Actor
   FROM dbo.AuditLogs l
   LEFT JOIN dbo.Employees e ON e.AccountId = l.AccountId
   WHERE l.EntityName = 'Order' AND l.EntityId = @entityId
   ORDER BY l.AuditId`,
  { entityId: String(orderId) }
);

exports.approve = (orderId, accountId) => db.exec('sp_ApproveOrder', { OrderId: orderId, AccountId: accountId });
exports.cancel = (orderId, reason, accountId) => db.exec('sp_CancelOrder', { OrderId: orderId, Reason: reason, AccountId: accountId });
exports.confirmPayment = (orderId, accountId) => db.exec('sp_ConfirmPayment', { OrderId: orderId, AccountId: accountId });
exports.complete = (orderId, accountId) => db.exec('sp_CompleteOrder', { OrderId: orderId, AccountId: accountId });
exports.confirmRefund = (orderId, accountId) => db.exec('sp_ConfirmRefund', { OrderId: orderId, AccountId: accountId });

exports.PAGE_SIZE = PAGE_SIZE;
