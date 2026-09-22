// MODULE 2 - CRUD Thương hiệu: VÍ DỤ HOÀN CHỈNH (list / form / create / update / delete + flash + audit + bắt lỗi FK)
// Các CRUD khác (sản phẩm, danh mục, NCC, người dùng...) nên viết theo đúng khuôn này.
const Brand = require('../../models/brand.model');
const audit = require('../../models/audit.model');

exports.index = async (req, res) => {
  const brands = await Brand.list({ q: req.query.q });
  res.render('staff/brands/index', { title: 'Thương hiệu', brands, q: req.query.q || '' });
};

exports.showCreate = (req, res) => res.render('staff/brands/form', { title: 'Thêm thương hiệu', brand: {}, action: '/staff/brands' });

exports.create = async (req, res) => {
  const name = (req.body.brandName || '').trim();
  if (!name) { req.flash('danger', 'Tên thương hiệu không được trống.'); return res.redirect('/staff/brands/new'); }
  try {
    await Brand.create({ brandName: name, country: req.body.country });
    await audit.log(req, 'CREATE', 'Brand', null, name);
    req.flash('success', 'Đã thêm thương hiệu.');
    res.redirect('/staff/brands');
  } catch (e) {
    if (e.number === 2627 || e.number === 2601) { req.flash('danger', 'Tên thương hiệu đã tồn tại.'); return res.redirect('/staff/brands/new'); }
    throw e;
  }
};

exports.showEdit = async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) return res.status(404).render('errors/404', { layout: 'layouts/staff', title: 'Không tìm thấy' });
  res.render('staff/brands/form', { title: 'Sửa thương hiệu', brand, action: `/staff/brands/${brand.BrandId}` });
};

exports.update = async (req, res) => {
  await Brand.update(req.params.id, { brandName: req.body.brandName.trim(), country: req.body.country, isActive: req.body.isActive });
  await audit.log(req, 'UPDATE', 'Brand', req.params.id);
  req.flash('success', 'Đã cập nhật thương hiệu.');
  res.redirect('/staff/brands');
};

exports.remove = async (req, res) => {
  try {
    await Brand.remove(req.params.id);
    await audit.log(req, 'DELETE', 'Brand', req.params.id);
    req.flash('success', 'Đã xoá thương hiệu.');
  } catch (e) {
    if (e.number === 547) req.flash('warning', 'Thương hiệu đang có sản phẩm, không thể xoá. Hãy chuyển sang "Ngừng dùng".');
    else throw e;
  }
  res.redirect('/staff/brands');
};
