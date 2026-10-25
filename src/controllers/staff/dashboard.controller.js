// MODULE 4 - NV BÁN HÀNG: tổng quan (đơn cần xử lý, doanh thu, hàng sắp hết)
const Order = require('../../models/order.model');
const Report = require('../../models/report.model');
const Stock = require('../../models/stock.model');

exports.index = async (req, res) => {
  const range = Report.normalizeRange({ group: 'day' });
  const week = Report.normalizeRange({ from: new Date(Date.parse(`${range.to}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10), to: range.to });
  const [counts, quick, weekData, pending, lowStock] = await Promise.all([
    Order.counts(), Report.quick(), Report.revenue(week), Order.search({ status: 'Pending' }, 1), Stock.lowStock(6),
  ]);
  res.render('staff/dashboard', { title: 'Tổng quan bán hàng', counts, quick, week: weekData, pending: pending.rows.slice(0, 6), lowStock });
};
