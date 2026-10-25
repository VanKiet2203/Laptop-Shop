// MODULE 1 - ADMIN: nhật ký hoạt động hệ thống (chỉ xem, không sửa/xoá)
const audit = require('../../models/audit.model');

// GET /admin/audit-logs
exports.index = async (req, res) => {
  const [result, facets] = await Promise.all([audit.search(req.query, req.query.page), audit.facets()]);
  res.render('admin/audit', { title: 'Nhật ký hoạt động', logs: result.rows, pg: result.pg, filters: result.filters, facets });
};
