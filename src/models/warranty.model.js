// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo: tra cứu bảo hành điện tử. Model = nơi DUY NHẤT chứa SQL của nhóm này.
// Bảng liên quan: Warranties, ProductSerials, OrderDetails, Orders, Customers (bảo hành được tạo khi duyệt đơn - sp_ApproveOrder)
const db = require('../config/db');
const { paginate } = require('../core/helpers');

const PAGE_SIZE = 15;
const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

exports.normalizeFilters = (q = {}) => ({
  q: typeof q.q === 'string' ? q.q.trim().slice(0, 60) : '',
  state: ['active', 'expiring', 'expired', 'voided'].includes(q.state) ? q.state : '',
});

/**
 * Tìm theo Serial / IMEI / mã đơn / tên khách / SĐT khách / tên sản phẩm.
 * state: active (còn hạn), expiring (còn dưới 30 ngày), expired (hết hạn), voided (đã vô hiệu do huỷ đơn).
 */
exports.search = async (filters, page) => {
  const f = exports.normalizeFilters(filters);
  const params = { q: f.q, state: f.state, phone: digitsOnly(f.q).length >= 6 ? digitsOnly(f.q) : '' };
  const from = `FROM dbo.Warranties w
     JOIN dbo.ProductSerials s ON s.SerialId = w.SerialId
     JOIN dbo.Products p ON p.ProductId = s.ProductId
     JOIN dbo.OrderDetails od ON od.OrderDetailId = w.OrderDetailId
     JOIN dbo.Orders o ON o.OrderId = od.OrderId
     JOIN dbo.Customers c ON c.CustomerId = w.CustomerId
     WHERE (@q = '' OR s.SerialNumber LIKE '%' + @q + '%' OR s.Imei LIKE '%' + @q + '%' OR o.OrderNo LIKE '%' + @q + '%'
            OR o.ReceiverName LIKE '%' + @q + '%' OR c.FullName LIKE '%' + @q + '%' OR p.ProductName LIKE '%' + @q + '%'
            OR (@phone <> '' AND (o.ReceiverPhone LIKE '%' + @phone + '%' OR c.Phone LIKE '%' + @phone + '%')))
       AND (@state = ''
            OR (@state = 'voided' AND w.Status = 'Voided')
            OR (@state = 'active' AND w.Status = 'Active' AND w.EndDate >= CAST(SYSDATETIME() AS DATE))
            OR (@state = 'expiring' AND w.Status = 'Active' AND w.EndDate >= CAST(SYSDATETIME() AS DATE) AND w.EndDate < DATEADD(DAY, 30, CAST(SYSDATETIME() AS DATE)))
            OR (@state = 'expired' AND w.Status = 'Active' AND w.EndDate < CAST(SYSDATETIME() AS DATE)))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n ${from}`, params)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT w.WarrantyId, w.StartDate, w.EndDate, w.Status,
            DATEDIFF(DAY, CAST(SYSDATETIME() AS DATE), w.EndDate) AS DaysLeft,
            s.SerialNumber, s.Imei, p.ProductName, p.Sku, o.OrderId, o.OrderNo, o.ReceiverName, o.ReceiverPhone, c.FullName AS CustomerName
     ${from}
     ORDER BY w.WarrantyId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...params, offset: pg.offset, size: pg.pageSize });
  rows.forEach((r) => {
    if (r.Status === 'Voided') r.State = 'voided';
    else if (r.DaysLeft < 0) r.State = 'expired';
    else if (r.DaysLeft < 30) r.State = 'expiring';
    else r.State = 'active';
  });
  return { rows, pg, filters: f };
};

exports.summary = () => db.queryOne(
  `SELECT COUNT(*) AS total,
          SUM(CASE WHEN Status = 'Active' AND EndDate >= CAST(SYSDATETIME() AS DATE) THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN Status = 'Active' AND EndDate >= CAST(SYSDATETIME() AS DATE) AND EndDate < DATEADD(DAY, 30, CAST(SYSDATETIME() AS DATE)) THEN 1 ELSE 0 END) AS expiring,
          SUM(CASE WHEN Status = 'Active' AND EndDate < CAST(SYSDATETIME() AS DATE) THEN 1 ELSE 0 END) AS expired
   FROM dbo.Warranties`);

exports.PAGE_SIZE = PAGE_SIZE;
