// MODULE 2 - CỬA HÀNG (khách xem sản phẩm)   (mount: /)
// Chủ sở hữu file: Thành viên 2 - Danh mục sản phẩm
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { useLayout } = require('../core/locals');

router.use(useLayout('layouts/store'));

const store_home = require('../controllers/store/home.controller');

router.get('/', wrap(store_home.index));

const store_product = require('../controllers/store/product.controller');

router.get('/products', wrap(store_product.index));
router.get('/category/:slug', wrap(store_product.byCategory));
router.get('/products/:slug', wrap(store_product.show));

module.exports = router;
