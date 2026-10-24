// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo: thống kê doanh thu / sản phẩm bán chạy. Model = nơi DUY NHẤT chứa SQL của nhóm này.
// View liên quan: vw_SalesDaily (doanh thu theo ngày duyệt đơn), vw_ProductSales (doanh số + lợi nhuận gộp theo sản phẩm), vw_LowStock
const db = require('../config/db');
const { parseDateStr } = require('../core/helpers');

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/** Khoảng ngày của báo cáo: mặc định 30 ngày gần nhất; to >= from; tối đa 366 ngày */
exports.normalizeRange = (q = {}, now = new Date()) => {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let to = parseDateStr(q.to) || iso(today);
  let from = parseDateStr(q.from) || iso(addDays(new Date(`${to}T00:00:00Z`), -29));
  if (from > to) [from, to] = [to, from];
  const days = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) from = iso(addDays(new Date(`${to}T00:00:00Z`), -365));
  const group = q.group === 'month' ? 'month' : 'day';
  return { from, to, group };
};

const sumRange = (from, to) => db.queryOne(
  `SELECT ISNULL(SUM(OrderCount), 0) AS orders, ISNULL(SUM(GrossAmount), 0) AS gross, ISNULL(SUM(DiscountAmount), 0) AS discount,
          ISNULL(SUM(VatAmount), 0) AS vat, ISNULL(SUM(Revenue), 0) AS revenue
   FROM dbo.vw_SalesDaily WHERE SaleDate BETWEEN @from AND @to`, { from, to });

/**
 * Doanh thu theo ngày (hoặc theo tháng) trong khoảng [from, to], điền đủ cả ngày/tháng không có đơn để biểu đồ không đứt đoạn.
 * Kèm tổng của kỳ trước có cùng độ dài để so sánh.
 */
exports.revenue = async ({ from, to, group }) => {
  const rows = await db.query(
    `SELECT SaleDate, OrderCount, GrossAmount, DiscountAmount, VatAmount, Revenue FROM dbo.vw_SalesDaily
     WHERE SaleDate BETWEEN @from AND @to ORDER BY SaleDate`, { from, to });
  const byDay = new Map(rows.map((r) => [iso(new Date(r.SaleDate)), r]));
  const empty = () => ({ orders: 0, gross: 0, discount: 0, vat: 0, revenue: 0 });
  const add = (a, r) => { a.orders += r.OrderCount; a.gross += Number(r.GrossAmount); a.discount += Number(r.DiscountAmount); a.vat += Number(r.VatAmount); a.revenue += Number(r.Revenue); };
  const buckets = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (group === 'month') {
    const idx = new Map();
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const key = iso(d).slice(0, 7);
      const b = { key, label: `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`, ...empty() };
      idx.set(key, b); buckets.push(b);
    }
    rows.forEach((r) => add(idx.get(iso(new Date(r.SaleDate)).slice(0, 7)), r));
  } else {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = iso(d); const r = byDay.get(key);
      const b = { key, label: `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`, ...empty() };
      if (r) add(b, r);
      buckets.push(b);
    }
  }
  const totals = buckets.reduce((t, b) => { t.orders += b.orders; t.gross += b.gross; t.discount += b.discount; t.vat += b.vat; t.revenue += b.revenue; return t; }, empty());
  const days = Math.round((end - start) / 86400000) + 1;
  const prevTo = iso(addDays(start, -1));
  const prevFrom = iso(addDays(start, -days));
  const prev = await sumRange(prevFrom, prevTo);
  return { buckets, totals, prev: { orders: prev.orders, revenue: Number(prev.revenue) }, days, prevFrom, prevTo };
};

/** Doanh thu hôm nay / tháng này (tổng quan) */
exports.quick = () => db.queryOne(
  `SELECT (SELECT ISNULL(SUM(Revenue), 0) FROM dbo.vw_SalesDaily WHERE SaleDate = CAST(SYSDATETIME() AS DATE)) AS todayRevenue,
          (SELECT ISNULL(SUM(OrderCount), 0) FROM dbo.vw_SalesDaily WHERE SaleDate = CAST(SYSDATETIME() AS DATE)) AS todayOrders,
          (SELECT ISNULL(SUM(Revenue), 0) FROM dbo.vw_SalesDaily WHERE SaleDate >= DATEADD(DAY, 1 - DAY(CAST(SYSDATETIME() AS DATE)), CAST(SYSDATETIME() AS DATE))) AS monthRevenue,
          (SELECT ISNULL(SUM(OrderCount), 0) FROM dbo.vw_SalesDaily WHERE SaleDate >= DATEADD(DAY, 1 - DAY(CAST(SYSDATETIME() AS DATE)), CAST(SYSDATETIME() AS DATE))) AS monthOrders`);

const PRODUCT_SORTS = {
  qty: 'QtySold DESC, SalesAmount DESC',
  revenue: 'NetSalesAmount DESC',
  profit: 'GrossProfit DESC',
  margin: 'CASE WHEN NetSalesAmount = 0 THEN -1 ELSE GrossProfit * 1.0 / NetSalesAmount END DESC',
};

exports.normalizeProductFilters = (q = {}) => ({
  sort: PRODUCT_SORTS[q.sort] ? q.sort : 'qty',
  category: typeof q.category === 'string' ? q.category.trim().slice(0, 100) : '',
  limit: [10, 20, 50].includes(Number(q.limit)) ? Number(q.limit) : 20,
});

exports.topProducts = async (filters) => {
  const f = exports.normalizeProductFilters(filters);
  const rows = await db.query(
    `SELECT TOP (@limit) ProductId, Sku, ProductName, CategoryName, BrandName, QtySold, SalesAmount, NetSalesAmount, CostAmount, GrossProfit,
            CASE WHEN NetSalesAmount = 0 THEN 0 ELSE ROUND(GrossProfit * 100.0 / NetSalesAmount, 1) END AS MarginPct
     FROM dbo.vw_ProductSales
     WHERE (@category = '' OR CategoryName = @category)
     ORDER BY ${PRODUCT_SORTS[f.sort]}`, f);
  const totals = await db.queryOne(
    `SELECT ISNULL(SUM(QtySold), 0) AS qty, ISNULL(SUM(NetSalesAmount), 0) AS revenue, ISNULL(SUM(GrossProfit), 0) AS profit
     FROM dbo.vw_ProductSales WHERE (@category = '' OR CategoryName = @category)`, f);
  const categories = await db.query('SELECT DISTINCT CategoryName FROM dbo.vw_ProductSales ORDER BY CategoryName');
  return { rows, totals, categories: categories.map((c) => c.CategoryName), filters: f };
};
