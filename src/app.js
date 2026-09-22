const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const { locals } = require('./core/locals');
const { isBusinessError } = require('./core/helpers');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/store'); // layout mặc định = giao diện cửa hàng

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 },
}));
app.use(locals);

app.use('/', require('./routes'));

// 404
app.use((req, res) => res.status(404).render('errors/404', { layout: 'layouts/store', title: 'Không tìm thấy trang' }));

// Xử lý lỗi chung: lỗi nghiệp vụ (THROW 50xxx từ SQL) hiển thị thân thiện, lỗi khác -> 500
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (isBusinessError(err)) {
    req.flash('danger', err.message);
    return res.redirect(req.get('Referer') || '/');
  }
  console.error(err);
  res.status(500).render('errors/500', { layout: 'layouts/store', title: 'Lỗi hệ thống', error: process.env.NODE_ENV === 'production' ? null : err });
});

module.exports = app;
