
const db = require('../config/db');

// MODULE 4 - MODEL BÁO CÁO
// Mọi câu lệnh SQL của chức năng báo cáo nằm trong file này.

/**
 * Chuẩn hóa khoảng ngày và kiểu nhóm báo cáo.
 */
function normalizeRange({ from, to, group } = {}) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);

  const defaultFromDate = new Date(today);
  defaultFromDate.setDate(defaultFromDate.getDate() - 29);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

  const validGroups = ['day', 'month', 'year'];

  return {
    from: from || defaultFrom,
    to: to || defaultTo,
    group: validGroups.includes(group) ? group : 'day'
  };
}

/**
 * 1. Báo cáo doanh thu theo ngày, tháng hoặc năm.
 * View: vw_SalesDaily.
 */
exports.revenue = async ({ from, to, group } = {}) => {
  const range = normalizeRange({ from, to, group });

  const rows = await db.query(
    `SELECT *
     FROM dbo.vw_SalesDaily
     WHERE SaleDate >= @from
       AND SaleDate < DATEADD(DAY, 1, CAST(@to AS DATE))
     ORDER BY SaleDate`,
    {
      from: range.from,
      to: range.to
    }
  );

  const buckets = new Map();

  for (const row of rows) {
    const date = new Date(row.SaleDate);
    let key;

    if (range.group === 'year') {
      key = String(date.getFullYear());
    } else if (range.group === 'month') {
      key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;
    } else {
      key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');
    }

    const current = buckets.get(key) || {
      period: key,
      revenue: 0,
      orderCount: 0,
      grossAmount: 0,
      discountAmount: 0,
      vatAmount: 0
    };

    current.revenue += Number(row.Revenue || 0);
    current.orderCount += Number(row.OrderCount || 0);
    current.grossAmount += Number(row.GrossAmount || 0);
    current.discountAmount += Number(row.DiscountAmount || 0);
    current.vatAmount += Number(row.VatAmount || 0);

    buckets.set(key, current);
  }

  const resultRows = Array.from(buckets.values());

  return {
    from: range.from,
    to: range.to,
    group: range.group,
    rows: resultRows,
    totalRevenue: resultRows.reduce(
      (sum, row) => sum + row.revenue,
      0
    ),
    totalOrders: resultRows.reduce(
      (sum, row) => sum + row.orderCount,
      0
    ),
    totalGrossAmount: resultRows.reduce(
      (sum, row) => sum + row.grossAmount,
      0
    ),
    totalDiscountAmount: resultRows.reduce(
      (sum, row) => sum + row.discountAmount,
      0
    ),
    totalVatAmount: resultRows.reduce(
      (sum, row) => sum + row.vatAmount,
      0
    )
  };
};

/**
 * 2. Danh sách sản phẩm bán chạy.
 * View: vw_ProductSales.
 *
 * Lưu ý: View hiện tại chưa xác nhận có cột ngày bán,
 * nên chưa thể lọc theo from/to tại đây.
 */
exports.topProducts = async ({ from, to, limit } = {}) => {
  const range = normalizeRange({ from, to });

  const safeLimit = [10, 20, 50].includes(Number(limit))
    ? Number(limit)
    : 10;

  const rows = await db.query(
    `SELECT TOP (${safeLimit}) *
     FROM dbo.vw_ProductSales
     ORDER BY QtySold DESC`,
    {}
  );

  return {
    from: range.from,
    to: range.to,
    products: rows
  };
};

/**
 * 3. Các thẻ thống kê nhanh trong tháng hiện tại.
 * View: vw_SalesDaily.
 */
exports.dashboardCards = async () => {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(Revenue), 0) AS TotalRevenue,
       COALESCE(SUM(OrderCount), 0) AS TotalOrders,
       COALESCE(SUM(GrossAmount), 0) AS TotalGrossAmount,
       COALESCE(SUM(DiscountAmount), 0) AS TotalDiscountAmount,
       COALESCE(SUM(VatAmount), 0) AS TotalVatAmount
     FROM dbo.vw_SalesDaily
     WHERE SaleDate >= DATEFROMPARTS(
       YEAR(GETDATE()), MONTH(GETDATE()), 1
     )
       AND SaleDate < DATEADD(
         DAY, 1, CAST(GETDATE() AS DATE)
       )`,
    {}
  );

  return result[0] || {
    TotalRevenue: 0,
    TotalOrders: 0,
    TotalGrossAmount: 0,
    TotalDiscountAmount: 0,
    TotalVatAmount: 0
  };
};
