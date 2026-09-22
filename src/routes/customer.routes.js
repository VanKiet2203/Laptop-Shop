// MODULE 3 - KHÁCH MUA HÀNG   (mount: /)
// Chủ sở hữu file: Thành viên 3 - Khách mua hàng
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requireRole, requirePermission } = require('../core/auth');
const { useLayout } = require('../core/locals');

router.use(useLayout('layouts/store'));

const customer_register = require('../controllers/customer/register.controller');

router.get('/register', wrap(customer_register.showRegister));
router.post('/register', wrap(customer_register.register));

const customer_account = require('../controllers/customer/account.controller');

router.get('/account', requireRole('CUSTOMER'), wrap(customer_account.profile));
router.post('/account', requireRole('CUSTOMER'), wrap(customer_account.updateProfile));
router.get('/account/addresses', requireRole('CUSTOMER'), wrap(customer_account.addresses));
router.post('/account/addresses', requireRole('CUSTOMER'), wrap(customer_account.addAddress));
router.post('/account/addresses/:id/delete', requireRole('CUSTOMER'), wrap(customer_account.deleteAddress));
router.post('/account/addresses/:id/default', requireRole('CUSTOMER'), wrap(customer_account.setDefault));

const customer_cart = require('../controllers/customer/cart.controller');

router.get('/cart', requireRole('CUSTOMER'), wrap(customer_cart.show));
router.post('/cart/add', requireRole('CUSTOMER'), wrap(customer_cart.add));
router.post('/cart/update', requireRole('CUSTOMER'), wrap(customer_cart.update));
router.post('/cart/remove/:productId', requireRole('CUSTOMER'), wrap(customer_cart.remove));

const customer_checkout = require('../controllers/customer/checkout.controller');

router.get('/checkout', requireRole('CUSTOMER'), wrap(customer_checkout.show));
router.post('/checkout/promo', requireRole('CUSTOMER'), wrap(customer_checkout.checkPromo));
router.post('/checkout', requireRole('CUSTOMER'), wrap(customer_checkout.place));

const customer_order = require('../controllers/customer/order.controller');

router.get('/orders', requireRole('CUSTOMER'), wrap(customer_order.index));
router.get('/orders/:id', requireRole('CUSTOMER'), wrap(customer_order.show));
router.post('/orders/:id/cancel', requireRole('CUSTOMER'), wrap(customer_order.cancel));

module.exports = router;
