// MODULE 1 - KHO (nhập hàng)   (mount: /warehouse)
// Chủ sở hữu file: Thành viên 1 - Hệ thống & Kho
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requireRole, requirePermission } = require('../core/auth');
const { useLayout } = require('../core/locals');

router.use(requireRole('WAREHOUSE'), useLayout('layouts/warehouse'));

const warehouse_dashboard = require('../controllers/warehouse/dashboard.controller');

router.get('/', wrap(warehouse_dashboard.index));

const warehouse_supplier = require('../controllers/warehouse/supplier.controller');

router.get('/suppliers', requirePermission('supplier.manage'), wrap(warehouse_supplier.index));
router.get('/suppliers/new', requirePermission('supplier.manage'), wrap(warehouse_supplier.showCreate));
router.post('/suppliers', requirePermission('supplier.manage'), wrap(warehouse_supplier.create));
router.get('/suppliers/:id/edit', requirePermission('supplier.manage'), wrap(warehouse_supplier.showEdit));
router.post('/suppliers/:id', requirePermission('supplier.manage'), wrap(warehouse_supplier.update));
router.post('/suppliers/:id/delete', requirePermission('supplier.manage'), wrap(warehouse_supplier.remove));

const warehouse_receipt = require('../controllers/warehouse/receipt.controller');

router.get('/receipts', requirePermission('stock.view'), wrap(warehouse_receipt.index));
router.get('/receipts/new', requirePermission('receipt.create'), wrap(warehouse_receipt.showCreate));
router.post('/receipts', requirePermission('receipt.create'), wrap(warehouse_receipt.create));
router.get('/receipts/:id', requirePermission('stock.view'), wrap(warehouse_receipt.show));
router.post('/receipts/:id/post', requirePermission('receipt.post'), wrap(warehouse_receipt.post));
router.post('/receipts/:id/cancel', requirePermission('receipt.create'), wrap(warehouse_receipt.cancel));
router.get('/receipts/:id/print', requirePermission('stock.view'), wrap(warehouse_receipt.print));

const warehouse_stock = require('../controllers/warehouse/stock.controller');

router.get('/stock', requirePermission('stock.view'), wrap(warehouse_stock.index));
router.get('/stock/serials', requirePermission('stock.view'), wrap(warehouse_stock.serials));
router.get('/stock/movements', requirePermission('stock.view'), wrap(warehouse_stock.movements));

module.exports = router;
