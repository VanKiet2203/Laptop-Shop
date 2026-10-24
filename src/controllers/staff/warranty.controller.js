// MODULE 4 - NV BÁN HÀNG: tra cứu bảo hành điện tử theo Serial / IMEI / mã đơn / khách hàng
const Warranty = require('../../models/warranty.model');

// GET /staff/warranty
exports.lookup = async (req, res) => {
  const [result, summary] = await Promise.all([Warranty.search(req.query, req.query.page), Warranty.summary()]);
  res.render('staff/warranty', { title: 'Tra cứu bảo hành', rows: result.rows, pg: result.pg, filters: result.filters, summary });
};
