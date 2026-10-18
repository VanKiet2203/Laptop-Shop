// MODULE 2 - QUẢN LÝ SẢN PHẨM (NV bán hàng)   (mount: /staff)
// Chủ sở hữu file: Thành viên 2 - Danh mục sản phẩm
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requirePermission } = require('../core/auth');

const staff_product = require('../controllers/staff/product.controller');

router.get('/products', requirePermission('product.view'), wrap(staff_product.index));
router.get('/products/new', requirePermission('product.create'), wrap(staff_product.showCreate));
router.post('/products', requirePermission('product.create'), wrap(staff_product.create));
router.get('/products/:id/edit', requirePermission('product.update'), wrap(staff_product.showEdit));
router.post('/products/:id', requirePermission('product.update'), wrap(staff_product.update));
router.post('/products/:id/delete', requirePermission('product.delete'), wrap(staff_product.remove));

const staff_category = require('../controllers/staff/category.controller');

router.get('/categories', requirePermission('category.manage'), wrap(staff_category.index));
router.get('/categories/new', requirePermission('category.manage'), wrap(staff_category.showCreate));
router.post('/categories', requirePermission('category.manage'), wrap(staff_category.create));
router.get('/categories/:id/edit', requirePermission('category.manage'), wrap(staff_category.showEdit));
router.post('/categories/:id', requirePermission('category.manage'), wrap(staff_category.update));
router.post('/categories/:id/delete', requirePermission('category.manage'), wrap(staff_category.remove));

const staff_brand = require('../controllers/staff/brand.controller');

router.get('/brands', requirePermission('brand.manage'), wrap(staff_brand.index));
router.get('/brands/new', requirePermission('brand.manage'), wrap(staff_brand.showCreate));
router.post('/brands', requirePermission('brand.manage'), wrap(staff_brand.create));
router.get('/brands/:id/edit', requirePermission('brand.manage'), wrap(staff_brand.showEdit));
router.post('/brands/:id', requirePermission('brand.manage'), wrap(staff_brand.update));
router.post('/brands/:id/delete', requirePermission('brand.manage'), wrap(staff_brand.remove));

const staff_attribute = require('../controllers/staff/attribute.controller');

router.get('/attributes', requirePermission('product.update'), wrap(staff_attribute.index));
router.get('/attributes/new', requirePermission('product.update'), wrap(staff_attribute.showCreate));
router.post('/attributes', requirePermission('product.update'), wrap(staff_attribute.create));
router.get('/attributes/:id/edit', requirePermission('product.update'), wrap(staff_attribute.showEdit));
router.post('/attributes/:id', requirePermission('product.update'), wrap(staff_attribute.update));
router.post('/attributes/:id/delete', requirePermission('product.update'), wrap(staff_attribute.remove));

module.exports = router;
