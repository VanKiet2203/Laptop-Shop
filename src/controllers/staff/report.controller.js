// MODULE 4 - NV BÁN HÀNG: thống kê doanh thu và sản phẩm bán chạy / lợi nhuận
const Report = require('../../models/report.model');

// GET /staff/reports?from=&to=&group=day|month
exports.index = async (req, res) => {
  const range = Report.normalizeRange(req.query);
  const data = await Report.revenue(range);
  res.render('staff/reports/revenue', { title: 'Thống kê doanh thu', range, data });
};

// GET /staff/reports/products?sort=&category=&limit=
exports.products = async (req, res) => {
  const result = await Report.topProducts(req.query);
  res.render('staff/reports/products', { title: 'Sản phẩm bán chạy & lợi nhuận', ...result });
};
