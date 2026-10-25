// Thành viên 1 - Hệ thống & Kho: tồn kho, tra cứu Serial, sổ kho. Model = nơi DUY NHẤT chứa SQL của nhóm này.
// Bảng / view liên quan: vw_ProductCatalog, vw_LowStock, ProductSerials, OrderDetailSerials, Warranties, AuditLogs
const db = require('../config/db');
const { paginate, parseDateStr } = require('../core/helpers');

const PAGE_SIZE = 20;
const STOCK_SORTS = {
  name: 'c.ProductName',
  available_asc: 'c.QtyAvailable, c.ProductName',
  available_desc: 'c.QtyAvailable DESC, c.ProductName',
  onhand_desc: 'c.QtyOnHand DESC, c.ProductName',
  value_desc: '(c.QtyOnHand * c.CostPrice) DESC, c.ProductName',
};
const SERIAL_STATUSES = ['Pending', 'InStock', 'Sold', 'InWarranty', 'SentToVendor', 'Defective'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const intOrEmpty = (v) => (/^\d{1,9}$/.test(String(v || '')) ? String(Number(v)) : '');

/* ---------- Tồn kho ---------- */
exports.normalizeStockFilters = (q = {}) => ({
  q: str(q.q, 100),
  categoryId: intOrEmpty(q.categoryId),
  level: ['low', 'out', 'ok'].includes(q.level) ? q.level : '',
  sort: STOCK_SORTS[q.sort] ? q.sort : 'name',
});

exports.searchStock = async (filters, page) => {
  const f = exports.normalizeStockFilters(filters);
  const where = `WHERE c.IsActive = 1
      AND (@q = '' OR c.ProductName LIKE '%' + @q + '%' OR c.Sku LIKE '%' + @q + '%')
      AND (@categoryId = '' OR c.CategoryId = TRY_CAST(@categoryId AS INT) OR c.CategoryParentId = TRY_CAST(@categoryId AS INT))
      AND (@level = ''
           OR (@level = 'out' AND c.QtyAvailable <= 0)
           OR (@level = 'low' AND c.QtyAvailable > 0 AND c.QtyAvailable <= c.ReorderLevel)
           OR (@level = 'ok' AND c.QtyAvailable > c.ReorderLevel))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n FROM dbo.vw_ProductCatalog c ${where}`, f)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT c.ProductId, c.Sku, c.ProductName, c.CategoryName, c.BrandName, c.IsSerialTracked, c.CostPrice, c.SalePrice,
            c.QtyOnHand, c.QtyReserved, c.QtyAvailable, c.ReorderLevel,
            (SELECT COUNT(*) FROM dbo.ProductSerials s WHERE s.ProductId = c.ProductId AND s.Status = 'InStock') AS SerialsInStock
     FROM dbo.vw_ProductCatalog c ${where}
     ORDER BY ${STOCK_SORTS[f.sort]}
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

/** Số liệu tổng quan toàn kho (sản phẩm đang bán) */
exports.summary = () => db.queryOne(
  `SELECT COUNT(*) AS skus, ISNULL(SUM(QtyOnHand), 0) AS onHand, ISNULL(SUM(QtyReserved), 0) AS reserved,
          ISNULL(SUM(QtyOnHand * CostPrice), 0) AS stockValue,
          SUM(CASE WHEN QtyAvailable <= 0 THEN 1 ELSE 0 END) AS outOfStock,
          SUM(CASE WHEN QtyAvailable > 0 AND QtyAvailable <= ReorderLevel THEN 1 ELSE 0 END) AS lowStock
   FROM dbo.vw_ProductCatalog WHERE IsActive = 1`);

exports.rootCategories = () => db.query(
  'SELECT CategoryId, CategoryName FROM dbo.Categories WHERE ParentId IS NULL AND IsActive = 1 ORDER BY SortOrder, CategoryName');

exports.lowStock = (top = 10) => db.query(
  `SELECT TOP (@top) ProductId, Sku, ProductName, CategoryName, QtyOnHand, QtyReserved, QtyAvailable, ReorderLevel
   FROM dbo.vw_LowStock ORDER BY QtyAvailable, ProductName`, { top });

/* ---------- Tra cứu Serial ---------- */
exports.normalizeSerialFilters = (q = {}) => ({
  q: str(q.q, 60),
  status: SERIAL_STATUSES.includes(q.status) ? q.status : '',
  productId: intOrEmpty(q.productId),
});

exports.searchSerials = async (filters, page) => {
  const f = exports.normalizeSerialFilters(filters);
  const where = `WHERE (@q = '' OR s.SerialNumber LIKE '%' + @q + '%' OR s.Imei LIKE '%' + @q + '%' OR s.Barcode LIKE '%' + @q + '%'
                        OR p.ProductName LIKE '%' + @q + '%' OR p.Sku LIKE '%' + @q + '%')
      AND (@status = '' OR s.Status = @status)
      AND (@productId = '' OR s.ProductId = TRY_CAST(@productId AS INT))`;
  const total = (await db.queryOne(
    `SELECT COUNT(*) AS n FROM dbo.ProductSerials s JOIN dbo.Products p ON p.ProductId = s.ProductId ${where}`, f)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT s.SerialId, s.SerialNumber, s.Imei, s.Barcode, s.Status, p.ProductId, p.Sku, p.ProductName,
            gr.ReceiptId, gr.ReceiptNo, gr.ReceiptDate, sup.SupplierName, grd.UnitCost,
            o.OrderId, o.OrderNo, o.ReceiverName,
            w.StartDate AS WarrantyStart, w.EndDate AS WarrantyEnd, w.Status AS WarrantyStatus
     FROM dbo.ProductSerials s
     JOIN dbo.Products p ON p.ProductId = s.ProductId
     JOIN dbo.GoodsReceiptDetails grd ON grd.ReceiptDetailId = s.ReceiptDetailId
     JOIN dbo.GoodsReceipts gr ON gr.ReceiptId = grd.ReceiptId
     JOIN dbo.Suppliers sup ON sup.SupplierId = gr.SupplierId
     LEFT JOIN dbo.OrderDetailSerials ods ON ods.SerialId = s.SerialId
     LEFT JOIN dbo.OrderDetails od ON od.OrderDetailId = ods.OrderDetailId
     LEFT JOIN dbo.Orders o ON o.OrderId = od.OrderId AND o.Status <> 'Cancelled'
     LEFT JOIN dbo.Warranties w ON w.SerialId = s.SerialId AND w.OrderDetailId = od.OrderDetailId
     ${where}
     ORDER BY s.SerialId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

/** Số Serial theo trạng thái, hiện trên các chip lọc nhanh */
exports.serialCounts = async () => {
  const rows = await db.query('SELECT Status, COUNT(*) AS n FROM dbo.ProductSerials GROUP BY Status');
  const out = { all: 0 };
  rows.forEach((r) => { out[r.Status] = r.n; out.all += r.n; });
  return out;
};

exports.serialProducts = () => db.query(
  `SELECT ProductId, Sku, ProductName FROM dbo.Products WHERE IsSerialTracked = 1 ORDER BY ProductName`);

/* ---------- Sổ kho (xuất/nhập) ---------- */
exports.normalizeMovementFilters = (q = {}) => ({
  q: str(q.q, 100),
  type: ['STOCK_IN', 'STOCK_OUT'].includes(q.type) ? q.type : '',
  from: parseDateStr(q.from),
  to: parseDateStr(q.to),
});

exports.searchMovements = async (filters, page) => {
  const f = exports.normalizeMovementFilters(filters);
  const from = `FROM dbo.AuditLogs l
     JOIN dbo.Products p ON p.ProductId = TRY_CAST(l.EntityId AS INT)
     LEFT JOIN dbo.Accounts a ON a.AccountId = l.AccountId
     LEFT JOIN dbo.Employees e ON e.AccountId = l.AccountId
     WHERE l.EntityName = 'Product' AND l.Action IN ('STOCK_IN', 'STOCK_OUT')
       AND (@type = '' OR l.Action = @type)
       AND (@q = '' OR p.ProductName LIKE '%' + @q + '%' OR p.Sku LIKE '%' + @q + '%')
       AND (@from = '' OR l.CreatedAt >= @from)
       AND (@to = '' OR l.CreatedAt < DATEADD(DAY, 1, CAST(@to AS DATE)))`;
  const total = (await db.queryOne(`SELECT COUNT(*) AS n ${from}`, f)).n;
  const pg = paginate(page, PAGE_SIZE, total);
  const rows = await db.query(
    `SELECT l.AuditId, l.Action, l.Detail, l.CreatedAt, p.ProductId, p.Sku, p.ProductName,
            COALESCE(e.FullName, a.Username, N'Hệ thống') AS Actor
     ${from}
     ORDER BY l.AuditId DESC
     OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...f, offset: pg.offset, size: pg.pageSize });
  return { rows, pg, filters: f };
};

exports.PAGE_SIZE = PAGE_SIZE;
exports.SERIAL_STATUSES = SERIAL_STATUSES;
