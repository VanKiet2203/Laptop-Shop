const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const ctrl = require('../controllers/auth/auth.controller');

router.get('/login', ctrl.showLogin);
router.post('/login', wrap(ctrl.login));
router.post('/logout', ctrl.logout);
router.get('/logout', ctrl.logout);

module.exports = router;
