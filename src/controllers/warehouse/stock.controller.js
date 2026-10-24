// MODULE 1 - KHO: tồn kho, tra cứu Serial, sổ kho (chỉ xem - việc thay đổi tồn đi qua phiếu nhập / duyệt đơn)
const Stock = require('../../models/stock.model');

// GET /warehouse/stock
exports.index = async (req, res) => {
  const [result, summary, categories] = await Promise.all([Stock.searchStock(req.query, req.query.page), Stock.summary(), Stock.rootCategories()]);
  res.render('warehouse/stock/index', { title: 'Tồn kho', products: result.rows, pg: result.pg, filters: result.filters, summary, categories });
};

// GET /warehouse/stock/serials
exports.serials = async (req, res) => {
  const [result, counts, products] = await Promise.all([Stock.searchSerials(req.query, req.query.page), Stock.serialCounts(), Stock.serialProducts()]);
  res.render('warehouse/stock/serials', { title: 'Tra cứu Serial', serials: result.rows, pg: result.pg, filters: result.filters, counts, products, statuses: Stock.SERIAL_STATUSES });
};

// GET /warehouse/stock/movements
exports.movements = async (req, res) => {
  const result = await Stock.searchMovements(req.query, req.query.page);
  res.render('warehouse/stock/movements', { title: 'Sổ kho (xuất nhập tồn)', rows: result.rows, pg: result.pg, filters: result.filters });
};
