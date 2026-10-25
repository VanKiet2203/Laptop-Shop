// MODULE 2 - CRUD Thương hiệu: VÍ DỤ HOÀN CHỈNH (list / form / create / update / delete + flash + audit + bắt lỗi FK)
// Các CRUD khác (sản phẩm, danh mục, NCC, người dùng...) nên viết theo đúng khuôn này.
const Brand = require('../../models/brand.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');

function parseId(value) {
  const id = Number(value);
  return /^\d+$/.test(String(value))
    && Number.isSafeInteger(id)
    && id > 0
    && id <= 2147483647
    ? id
    : null;
}

function parseBrandForm(body) {
  const brandName = typeof body.brandName === 'string' ? body.brandName.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  if (!brandName) return { error: 'Tên thương hiệu không được để trống.' };
  if (brandName.length > 100) return { error: 'Tên thương hiệu không được vượt quá 100 ký tự.' };
  if (country.length > 60) return { error: 'Quốc gia không được vượt quá 60 ký tự.' };
  return {
    value: {
      brandName,
      country: country || null,
      isActive: body.isActive === '1',
    },
  };
}

exports.index = async (req, res) => {
  const brands = await Brand.list({ q: req.query.q });
  res.render('staff/brands/index', { title: 'Thương hiệu', brands, q: req.query.q || '' });
};

exports.showCreate = (req, res) => res.render('staff/brands/form', { title: 'Thêm thương hiệu', brand: {}, action: '/staff/brands' });

exports.create = async (req, res) => {
  const parsed = parseBrandForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect('/staff/brands/new');
  }
  try {
    await db.transaction(async (transaction) => {
      const brandId = await Brand.create(parsed.value, transaction);
      if (!brandId) throw new Error('Không nhận được mã thương hiệu vừa tạo.');
      await audit.logInTransaction(transaction, req, 'CREATE', 'Brand', brandId, parsed.value.brandName);
    });
    req.flash('success', 'Đã thêm thương hiệu.');
    res.redirect('/staff/brands');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) { req.flash('danger', 'Tên thương hiệu đã tồn tại.'); return res.redirect('/staff/brands/new'); }
    throw e;
  }
};

exports.showEdit = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy' });
  const brand = await Brand.findById(id);
  if (!brand) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy' });
  res.render('staff/brands/form', { title: 'Sửa thương hiệu', brand, action: `/staff/brands/${brand.BrandId}` });
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Mã thương hiệu không hợp lệ.');
    return res.redirect('/staff/brands');
  }
  const parsed = parseBrandForm(req.body);
  if (parsed.error) {
    req.flash('danger', parsed.error);
    return res.redirect(`/staff/brands/${id}/edit`);
  }

  try {
    const result = await db.transaction(async (transaction) => {
      const updated = await Brand.update(id, parsed.value, transaction);
      if (!updated.updated) return updated;
      await audit.logInTransaction(transaction, req, 'UPDATE', 'Brand', id, parsed.value.brandName);
      return updated;
    });
    if (result.hasActiveProducts) {
      req.flash('warning', 'Không thể ngừng thương hiệu khi còn sản phẩm đang bán. Hãy ngừng bán các sản phẩm trước.');
      return res.redirect(`/staff/brands/${id}/edit`);
    }
    if (result.notFound) {
      req.flash('danger', 'Thương hiệu không tồn tại hoặc đã được xoá.');
      return res.redirect('/staff/brands');
    }
    req.flash('success', 'Đã cập nhật thương hiệu.');
    return res.redirect('/staff/brands');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) {
      req.flash('danger', 'Tên thương hiệu đã tồn tại.');
      return res.redirect(`/staff/brands/${id}/edit`);
    }
    throw e;
  }
};

exports.remove = async (req, res) => {
  const id = parseId(req.params.id);
  if (id == null) {
    req.flash('danger', 'Mã thương hiệu không hợp lệ.');
    return res.redirect('/staff/brands');
  }
  try {
    const removed = await db.transaction(async (transaction) => {
      const didRemove = await Brand.remove(id, transaction);
      if (!didRemove) return false;
      await audit.logInTransaction(transaction, req, 'DELETE', 'Brand', id);
      return true;
    });
    if (!removed) {
      req.flash('danger', 'Thương hiệu không tồn tại hoặc đã được xoá.');
      return res.redirect('/staff/brands');
    }
    req.flash('success', 'Đã xoá thương hiệu.');
  } catch (e) {
    if (e.number === 547) req.flash('warning', 'Thương hiệu đang có sản phẩm, không thể xoá. Hãy chuyển sang "Ngừng dùng".');
    else throw e;
  }
  res.redirect('/staff/brands');
};
