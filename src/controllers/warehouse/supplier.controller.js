// MODULE 1 - KHO: Nhà cung cấp (CRUD theo khuôn của brand.controller: flash + audit trong transaction + bắt lỗi trùng/FK)
const Supplier = require('../../models/supplier.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const { parseId } = require('../../core/helpers');

const NOT_FOUND = { layout: 'layouts/warehouse', title: 'Không tìm thấy' };
const text = (v) => (typeof v === 'string' ? v.trim() : '');

function parseForm(body) {
  const d = {
    supplierName: text(body.supplierName),
    taxCode: text(body.taxCode).replace(/\s+/g, ''),
    contactName: text(body.contactName),
    phone: text(body.phone).replace(/[\s.-]/g, ''),
    email: text(body.email).toLowerCase(),
    address: text(body.address),
    paymentTermDays: Number(text(body.paymentTermDays) === '' ? 30 : body.paymentTermDays),
    isActive: body.isActive === '1',
  };
  const errors = [];
  if (!d.supplierName) errors.push('Tên nhà cung cấp không được để trống.');
  else if (d.supplierName.length > 200) errors.push('Tên nhà cung cấp tối đa 200 ký tự.');
  if (d.taxCode && !/^[0-9]{10}(-[0-9]{3})?$/.test(d.taxCode)) errors.push('Mã số thuế gồm 10 chữ số (hoặc 13 số dạng 0123456789-001).');
  if (d.contactName.length > 100) errors.push('Tên người liên hệ tối đa 100 ký tự.');
  if (d.phone && !/^\+?[0-9]{8,14}$/.test(d.phone)) errors.push('Số điện thoại không hợp lệ.');
  if (d.email && (d.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))) errors.push('Email không hợp lệ.');
  if (d.address.length > 255) errors.push('Địa chỉ tối đa 255 ký tự.');
  if (!Number.isInteger(d.paymentTermDays) || d.paymentTermDays < 0 || d.paymentTermDays > 365) errors.push('Hạn thanh toán là số ngày từ 0 đến 365.');
  return { value: d, errors };
}

// GET /warehouse/suppliers
exports.index = async (req, res) => {
  const [result, totals] = await Promise.all([Supplier.search(req.query, req.query.page), Supplier.totals()]);
  res.render('warehouse/suppliers/index', { title: 'Nhà cung cấp', suppliers: result.rows, pg: result.pg, filters: result.filters, totals });
};

// GET /warehouse/suppliers/new
exports.showCreate = (req, res) => res.render('warehouse/suppliers/form', {
  title: 'Thêm nhà cung cấp', supplier: { PaymentTermDays: 30, IsActive: true }, action: '/warehouse/suppliers',
});

// POST /warehouse/suppliers
exports.create = async (req, res) => {
  const { value, errors } = parseForm(req.body || {});
  if (errors.length) {
    return res.status(400).render('warehouse/suppliers/form', {
      title: 'Thêm nhà cung cấp', action: '/warehouse/suppliers', errors,
      supplier: { ...value, SupplierName: value.supplierName, TaxCode: value.taxCode, ContactName: value.contactName, Phone: value.phone, Email: value.email, Address: value.address, PaymentTermDays: value.paymentTermDays, IsActive: value.isActive },
    });
  }
  try {
    await db.transaction(async (tx) => {
      const id = await Supplier.create(value, tx);
      await audit.logInTransaction(tx, req, 'CREATE', 'Supplier', id, value.supplierName);
    });
    req.flash('success', 'Đã thêm nhà cung cấp.');
    return res.redirect('/warehouse/suppliers');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      req.flash('danger', 'Mã số thuế này đã thuộc về một nhà cung cấp khác.');
      return res.redirect('/warehouse/suppliers/new');
    }
    throw e;
  }
};

// GET /warehouse/suppliers/:id/edit
exports.showEdit = async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = id ? await Supplier.findById(id) : null;
  if (!supplier) return res.status(404).render('errors/404', NOT_FOUND);
  res.render('warehouse/suppliers/form', { title: 'Sửa nhà cung cấp', supplier, action: `/warehouse/suppliers/${id}` });
};

// POST /warehouse/suppliers/:id
exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash('danger', 'Mã nhà cung cấp không hợp lệ.');
    return res.redirect('/warehouse/suppliers');
  }
  const { value, errors } = parseForm(req.body || {});
  if (errors.length) {
    req.flash('danger', errors.join(' '));
    return res.redirect(`/warehouse/suppliers/${id}/edit`);
  }
  try {
    const ok = await db.transaction(async (tx) => {
      const updated = await Supplier.update(id, value, tx);
      if (updated) await audit.logInTransaction(tx, req, 'UPDATE', 'Supplier', id, value.supplierName);
      return updated;
    });
    if (!ok) {
      req.flash('danger', 'Nhà cung cấp không tồn tại hoặc đã bị xoá.');
      return res.redirect('/warehouse/suppliers');
    }
    req.flash('success', 'Đã cập nhật nhà cung cấp.');
    return res.redirect('/warehouse/suppliers');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      req.flash('danger', 'Mã số thuế này đã thuộc về một nhà cung cấp khác.');
      return res.redirect(`/warehouse/suppliers/${id}/edit`);
    }
    throw e;
  }
};

// POST /warehouse/suppliers/:id/delete - chưa có phiếu nhập thì xoá, đã có thì chỉ ngừng hợp tác
exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash('danger', 'Mã nhà cung cấp không hợp lệ.');
    return res.redirect('/warehouse/suppliers');
  }
  const result = await db.transaction(async (tx) => {
    const r = await Supplier.removeOrDeactivate(id, tx);
    if (r !== 'notFound') await audit.logInTransaction(tx, req, r === 'deleted' ? 'DELETE' : 'UPDATE', 'Supplier', id, r === 'deleted' ? 'Xoá nhà cung cấp' : 'Ngừng hợp tác (đã có phiếu nhập)');
    return r;
  });
  if (result === 'deleted') req.flash('success', 'Đã xoá nhà cung cấp.');
  else if (result === 'deactivated') req.flash('warning', 'Nhà cung cấp đã có phiếu nhập nên được chuyển sang "Ngừng hợp tác" để giữ lịch sử.');
  else req.flash('danger', 'Nhà cung cấp không tồn tại hoặc đã được xoá.');
  return res.redirect('/warehouse/suppliers');
};
