// Gắn biến dùng chung cho mọi view + hàm req.flash + hàm chọn layout theo khu vực
const h = require('./helpers');
const site = require('./siteInfo');
const Product = require('../models/product.model');

// Cache-buster cho /css/app.css: cố định theo lần khởi động server, để trình duyệt
// không giữ bản CSS cũ sau khi deploy/sửa file (thêm ?v=... vào link).
const assetVersion = Date.now();

exports.locals = (req, res, next) => {
  res.locals.assetVersion = assetVersion;
  res.locals.site = site;
  req.flash = (type, message) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };
  res.locals.flash = req.session.flash || [];
  // Chỉ ghi lại session khi thật sự có thông báo cần xoá (tránh tạo/ghi phiên cho mọi lượt truy cập, kể cả bot)
  if (req.session.flash && req.session.flash.length) req.session.flash = [];
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.cartCount = req.session.cartCount || 0; // giỏ DB (khách đăng nhập) hoặc giỏ session (khách vãng lai)
  Object.assign(res.locals, h);
  res.locals.title = 'Laptop Shop';
  res.locals.megaMenu = [];
  next();
};

// Menu "mega" của cửa hàng (danh mục -> hãng, mức giá). Dữ liệu đã được cache trong model nên rẻ;
// lỗi DB thì bỏ qua (menu trống) chứ không làm hỏng cả trang.
exports.loadMenu = async (req, res, next) => {
  // Chỉ giao diện cửa hàng mới có menu danh mục; các khu admin / nhân viên / kho và API JSON không cần
  if (/^\/(admin|staff|warehouse|api|chat)(\/|$)/.test(req.path)) return next();
  try {
    res.locals.megaMenu = await Product.menuData();
  } catch (e) {
    console.error('Không tải được menu danh mục:', e.message);
  }
  return next();
};

/** router.use(useLayout('layouts/admin')) */
exports.useLayout = (layout) => (req, res, next) => { res.locals.layout = layout; next(); };
