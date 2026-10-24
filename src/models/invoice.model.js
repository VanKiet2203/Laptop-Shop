
/**
 * MODULE 4 - Model hoá đơn bán hàng
 * SQL chỉ nằm trong Model theo quy ước của nhóm.
 * Bảng: Invoices, Orders, OrderDetails, OrderDetailSerials,
 * Customers, Products.
 */
const db = require('../config/db');

// Tìm kiếm hoá đơn theo ngày phát hành và mã hoá đơn / tên người mua.
exports.search = ({ from, to, q } = {}) => db.query(
  `SELECT
      i.InvoiceId,
      i.InvoiceNo,
      i.OrderId,
      i.IssuedAt,
      i.BuyerName,
      i.BuyerCompany,
      i.SubtotalAmount,
      i.DiscountAmount,
      i.VatAmount,
      i.TotalAmount,
      i.PrintCount,
      i.Status
   FROM dbo.Invoices i
   WHERE (@from IS NULL OR i.IssuedAt >= @from)
     AND (@to IS NULL OR i.IssuedAt < DATEADD(DAY, 1, @to))
     AND (
       @q IS NULL
       OR i.InvoiceNo LIKE '%' + @q + '%'
       OR i.BuyerName LIKE '%' + @q + '%'
       OR i.BuyerCompany LIKE '%' + @q + '%'
     )
   ORDER BY i.IssuedAt DESC, i.InvoiceId DESC`,
  {
    from: from || null,
    to: to || null,
    q: q || null
  }
);

// Lấy thông tin hoá đơn và thông tin đơn hàng / khách hàng.
exports.findById = (id) => db.queryOne(
  `SELECT
      i.*,
      o.OrderNo,
      o.PaymentMethod,
      o.PaymentStatus,
      o.ReceiverName,
      o.ReceiverPhone,
      o.ShippingAddress,
      c.Phone AS CustomerPhone,
      c.Email AS CustomerEmail
   FROM dbo.Invoices i
   INNER JOIN dbo.Orders o ON o.OrderId = i.OrderId
   LEFT JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
   WHERE i.InvoiceId = @id`,
  { id }
);

// Lấy thông tin hoá đơn và các sản phẩm để hiển thị khi in.
exports.printData = async (id) => {
  const invoice = await exports.findById(id);
  if (!invoice) return null;

  const details = await db.query(
    `SELECT
        od.OrderDetailId,
        p.Sku,
        p.ProductName,
        od.Quantity,
        od.UnitPrice,
        od.WarrantyMonths,
        od.LineTotal,
        STRING_AGG(
          CONVERT(VARCHAR(30), s.SerialId), ', '
        ) AS Serials
     FROM dbo.OrderDetails od
     INNER JOIN dbo.Products p ON p.ProductId = od.ProductId
     LEFT JOIN dbo.OrderDetailSerials s
       ON s.OrderDetailId = od.OrderDetailId
     WHERE od.OrderId = @orderId
     GROUP BY
       od.OrderDetailId,
       p.Sku,
       p.ProductName,
       od.Quantity,
       od.UnitPrice,
       od.WarrantyMonths,
       od.LineTotal
     ORDER BY od.OrderDetailId`,
    { orderId: invoice.OrderId }
  );

  return { invoice, details };
};

// Tăng số lần in hoá đơn.
exports.increasePrintCount = (id) => db.query(
  `UPDATE dbo.Invoices
   SET PrintCount = ISNULL(PrintCount, 0) + 1
   WHERE InvoiceId = @id`,
  { id }
);

