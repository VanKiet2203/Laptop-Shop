// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo: hoá đơn bán hàng. Model = nơi DUY NHẤT chứa SQL của nhóm này.
// Bảng liên quan: Invoices, Orders, OrderDetails, OrderDetailSerials (hoá đơn được phát hành tự động khi duyệt đơn - sp_ApproveOrder)
const db = require('../config/db');
const { paginate, parseDateStr } = require('../core/helpers');

const PAGE_SIZE = 15;

exports.normalizeFilters = (q = {}) => ({
  q: typeof q.q === 'string' ? q.q.trim().slice(0, 60) : '',
  status: ['Issued', 'Voided'].includes(q.status) ? q.status : '',
  from: parseDateStr(q.from),
  to: parseDateStr(q.to),
});

exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const where = `WHERE (@q = '' OR i.InvoiceNo LIKE '%' + @q + '%' OR o.OrderNo LIKE '%' + @q + '%'
                        OR i.BuyerName LIKE '%' + @q + '%' OR i.BuyerCompany LIKE '%' + @q + '%' OR i.BuyerTaxCode LIKE '%' + @q + '%')
      AND (@status = '' OR i.Status = @status)
      AND (@from = '' OR i.IssuedAt >= @from)
      AND (@to = '' OR i.IssuedAt < DATEADD(DAY, 1, CAST(@to AS DATE)))`;
  const join = 'FROM dbo.Invoices i JOIN dbo.Orders o ON o.OrderId = i.OrderId';
  const agg = await db.queryOne(
    `SELECT COUNT(*) AS n, ISNULL(SUM(CASE WHEN i.Status = 'Issued' THEN i.TotalAmount END), 0) AS issuedTotal ${join} ${where}`, f);
  const pg = paginate(page, PAGE_SIZE, agg.n);
  const rows = await db.query(
    `SELECT i.InvoiceId, i.InvoiceNo, i.IssuedAt, i.BuyerName, i.BuyerCompany, i.TotalAmount, i.VatAmount, i.Status, i.PrintCount,
            o.OrderId, o.OrderNo
     ${join} ${where}
     ORDER BY i.InvoiceId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f, issuedTotal: agg.issuedTotal };
};

exports.findById = async (invoiceId) => {
  const invoice = await db.queryOne(
    `SELECT i.InvoiceId, i.InvoiceNo, i.IssuedAt, i.BuyerName, i.BuyerCompany, i.BuyerTaxCode, i.BuyerAddress,
            i.SubtotalAmount, i.DiscountAmount, i.VatAmount, i.TotalAmount, i.PrintCount, i.Status,
            e.FullName AS IssuedBy, e.EmployeeCode,
            o.OrderId, o.OrderNo, o.PaymentMethod, o.PaymentStatus, o.ShippingFee, o.VatRate, o.ReceiverPhone, o.Status AS OrderStatus
     FROM dbo.Invoices i
     JOIN dbo.Orders o ON o.OrderId = i.OrderId
     JOIN dbo.Employees e ON e.EmployeeId = i.IssuedByEmployee
     WHERE i.InvoiceId = @invoiceId`, { invoiceId });
  if (!invoice) return null;
  invoice.items = await db.query(
    `SELECT od.OrderDetailId, od.Quantity, od.UnitPrice, od.LineTotal, od.WarrantyMonths, p.Sku, p.ProductName,
            STUFF((SELECT ', ' + s.SerialNumber FROM dbo.OrderDetailSerials ods JOIN dbo.ProductSerials s ON s.SerialId = ods.SerialId
                   WHERE ods.OrderDetailId = od.OrderDetailId ORDER BY s.SerialId
                   FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Serials
     FROM dbo.OrderDetails od JOIN dbo.Products p ON p.ProductId = od.ProductId
     WHERE od.OrderId = @orderId ORDER BY od.OrderDetailId`, { orderId: invoice.OrderId });
  return invoice;
};

/** Ghi nhận một lần in (chỉ với hoá đơn còn hiệu lực) */
exports.markPrinted = (invoiceId) => db.query(
  "UPDATE dbo.Invoices SET PrintCount = PrintCount + 1 WHERE InvoiceId = @invoiceId AND Status = 'Issued'", { invoiceId });

exports.PAGE_SIZE = PAGE_SIZE;
