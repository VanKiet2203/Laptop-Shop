// MODULE 4 - NV BÁN HÀNG: hoá đơn bán hàng (phát hành tự động khi duyệt đơn; ở đây chỉ xem / in lại)
const Invoice = require('../../models/invoice.model');
const audit = require('../../models/audit.model');
const { parseId } = require('../../core/helpers');

const NOT_FOUND = { layout: 'layouts/staff', title: 'Không tìm thấy' };

// GET /staff/invoices
exports.index = async (req, res) => {
  const result = await Invoice.search(req.query, req.query.page);
  res.render('staff/invoices/index', { title: 'Hoá đơn bán hàng', invoices: result.rows, pg: result.pg, filters: result.filters, issuedTotal: result.issuedTotal });
};

// GET /staff/invoices/:id
exports.show = async (req, res) => {
  const id = parseId(req.params.id);
  const invoice = id ? await Invoice.findById(id) : null;
  if (!invoice) return res.status(404).render('errors/404', NOT_FOUND);
  res.render('staff/invoices/show', { title: `Hoá đơn ${invoice.InvoiceNo}`, invoice });
};

// GET /staff/invoices/:id/print - bản in (không layout), mỗi lần mở tăng số lần in
exports.print = async (req, res) => {
  const id = parseId(req.params.id);
  const invoice = id ? await Invoice.findById(id) : null;
  if (!invoice) return res.status(404).render('errors/404', NOT_FOUND);
  if (invoice.Status === 'Issued') {
    await Invoice.markPrinted(id);
    invoice.PrintCount += 1;
    await audit.log(req, 'PRINT', 'Invoice', id, `In hoá đơn ${invoice.InvoiceNo} (lần ${invoice.PrintCount})`);
  }
  res.render('staff/invoices/print', { layout: false, title: `Hoá đơn ${invoice.InvoiceNo}`, invoice });
};
