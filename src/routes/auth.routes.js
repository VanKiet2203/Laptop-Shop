const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const ctrl = require('../controllers/auth/auth.controller');
const google = require('../controllers/auth/google.controller');

router.get('/login', ctrl.showLogin);
router.post('/login', wrap(ctrl.login));
router.post('/logout', ctrl.logout);
router.get('/logout', ctrl.logout);

// Đăng nhập bằng Google (OAuth 2.0)
router.get('/google', google.start);
router.get('/google/callback', wrap(google.callback));

module.exports = router;
