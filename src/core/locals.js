// Gắn biến dùng chung cho mọi view + hàm req.flash + hàm chọn layout theo khu vực
const h = require('./helpers');

exports.locals = (req, res, next) => {
  req.flash = (type, message) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };
  res.locals.flash = req.session.flash || [];
  req.session.flash = [];
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.cartCount = req.session.cartCount || 0; // Module 3 cập nhật khi thêm giỏ
  Object.assign(res.locals, h);
  res.locals.title = 'Laptop Shop';
  next();
};

/** router.use(useLayout('layouts/admin')) */
exports.useLayout = (layout) => (req, res, next) => { res.locals.layout = layout; next(); };
