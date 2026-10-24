
/**
 * MODULE 4 - NV BÁN HÀNG: HOÁ ĐƠN
 * Controller xử lý yêu cầu và gọi Model; không viết SQL tại đây.
 */
const Invoice = require('../../models/invoice.model');

// GET /staff/invoices
exports.index = async (req, res) => {
  const from = req.query.from || '';
  const to = req.query.to || '';
  const q = (req.query.q || '').trim();

  const invoices = await Invoice.search({
    from: from || null,
    to: to || null,
    q: q || null
  });

  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.TotalAmount || 0),
    0
  );

  return res.render('staff/invoices/index', {
    title: 'Hoá đơn bán hàng',
    invoices,
    filters: { from, to, q },
    totalAmount
  });
};

// GET /staff/invoices/:id
exports.show = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).send('Mã hoá đơn không hợp lệ.');
  }

  const data = await Invoice.printData(id);

  if (!data) {
    return res.status(404).send('Không tìm thấy hoá đơn.');
  }

  return res.render('staff/invoices/show', {
    title: 'Chi tiết hoá đơn',
    invoice: data.invoice,
    details: data.details
  });
};

// GET /staff/invoices/:id/print
exports.print = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).send('Mã hoá đơn không hợp lệ.');
  }

  const data = await Invoice.printData(id);

  if (!data) {
    return res.status(404).send('Không tìm thấy hoá đơn.');
  }

  await Invoice.increasePrintCount(id);

  return res.render('staff/invoices/print', {
    layout: false,
    title: 'In hoá đơn',
    invoice: data.invoice,
    details: data.details
  });
};
