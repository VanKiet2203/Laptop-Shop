// MODULE 1 - KHO: tổng quan (số liệu tồn, cảnh báo sắp hết hàng, phiếu nhập gần đây)
const Stock = require('../../models/stock.model');
const Receipt = require('../../models/goodsReceipt.model');
const Supplier = require('../../models/supplier.model');

exports.index = async (req, res) => {
  const [summary, lowStock, month, counts, recent, supplierTotals] = await Promise.all([
    Stock.summary(), Stock.lowStock(8), Receipt.monthSummary(), Receipt.counts(), Receipt.recent(6), Supplier.totals(),
  ]);
  res.render('warehouse/dashboard', { title: 'Tổng quan kho', summary, lowStock, month, counts, recent, supplierTotals });
};
