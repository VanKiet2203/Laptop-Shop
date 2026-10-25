const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const { locals, loadMenu } = require('./core/locals');
const { isBusinessError } = require('./core/helpers');
const originCheck = require('./core/originCheck');
const SqlSessionStore = require('./core/sqlSessionStore');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// --- Cấu hình bắt buộc khi chạy thật ---
const DEFAULT_SECRETS = ['dev-secret', 'doi-chuoi-bi-mat-nay'];
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SECRETS[0];
if (DEFAULT_SECRETS.includes(sessionSecret)) {
  if (isProd) throw new Error('Thiếu SESSION_SECRET: hãy đặt một chuỗi ngẫu nhiên dài trong .env trước khi chạy NODE_ENV=production.');
  console.warn('[cảnh báo] Đang dùng SESSION_SECRET mặc định - chỉ chấp nhận khi phát triển trên máy cá nhân.');
}
// Chạy sau proxy/nginx/Render...: TRUST_PROXY=1 để lấy đúng IP khách và nhận biết HTTPS (cờ Secure của cookie)
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? 1 : tp);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/store'); // layout mặc định = giao diện cửa hàng

// Header bảo mật (CSP chỉ cho tải tài nguyên từ chính site; ảnh https cho phép vì có ảnh QR ngân hàng / ảnh Google).
// 'unsafe-inline' còn cần vì một số view dùng script/handler nhúng trực tiếp.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: isProd,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: isProd ? '7d' : 0 }));

// Phiên lưu trong SQL Server (SESSION_STORE=memory để dùng bộ nhớ). SameSite=Lax + kiểm tra Origin chống CSRF.
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: process.env.SESSION_STORE === 'memory' ? undefined : new SqlSessionStore(),
  cookie: { maxAge: 1000 * 60 * 60 * 8, httpOnly: true, sameSite: 'lax', secure: isProd ? 'auto' : false },
}));
app.use(require('./core/sessionSync')); // ghi phiên xong rồi mới trả lời (tránh race với kho session SQL)
app.use(originCheck(() => {
  try { return [new URL(process.env.APP_URL || '').host]; } catch (e) { return []; }
}));
app.use(locals);
app.use(loadMenu);

app.use('/', require('./routes'));

// 404
app.use((req, res) => res.status(404).render('errors/404', { layout: 'layouts/store', title: 'Không tìm thấy trang' }));

// Xử lý lỗi chung: lỗi nghiệp vụ (THROW 50xxx từ SQL) hiển thị thân thiện, lỗi khác -> 500.
// Chi tiết lỗi chỉ hiện khi NODE_ENV=development (mặc định ẩn để không lộ thông tin nội bộ).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (isBusinessError(err)) {
    const wantsJson = req.get('X-Requested-With') === 'fetch' || /json/.test(req.get('Accept') || '');
    if (wantsJson) return res.status(409).json({ ok: false, error: err.message });
    req.flash('danger', err.message);
    return res.redirect(req.get('Referer') || '/');
  }
  console.error(err);
  res.status(500).render('errors/500', { layout: 'layouts/store', title: 'Lỗi hệ thống', error: process.env.NODE_ENV === 'development' ? err : null });
});

module.exports = app;
