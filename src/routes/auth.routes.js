const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requireLogin } = require('../core/auth');
const ctrl = require('../controllers/auth/auth.controller');
const google = require('../controllers/auth/google.controller');

router.get('/login', ctrl.showLogin);
router.post('/login', wrap(ctrl.login));
router.post('/logout', ctrl.logout);
router.get('/logout', ctrl.logout);

// Quên mật khẩu: nhập email -> nhận link (1 lần, 60 phút) -> đặt mật khẩu mới
router.get('/forgot', ctrl.showForgot);
router.post('/forgot', wrap(ctrl.forgot));
router.get('/reset/:token', wrap(ctrl.showReset));
router.post('/reset/:token', wrap(ctrl.reset));

// Đổi mật khẩu khi đã đăng nhập (khách, nhân viên, admin)
router.get('/password', requireLogin, ctrl.showChangePassword);
router.post('/password', requireLogin, wrap(ctrl.changePassword));

// Đăng nhập bằng Google (OAuth 2.0)
router.get('/google', google.start);
router.get('/google/callback', wrap(google.callback));

module.exports = router;
