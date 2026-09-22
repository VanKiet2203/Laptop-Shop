// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO   (mount: /staff)
// Chủ sở hữu file: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requireRole, requirePermission } = require('../core/auth');

const staff_dashboard = require('../controllers/staff/dashboard.controller');

router.get('/', wrap(staff_dashboard.index));

const staff_order = require('../controllers/staff/order.controller');

router.get('/orders', requirePermission('order.view'), wrap(staff_order.index));
router.get('/orders/:id', requirePermission('order.view'), wrap(staff_order.show));
router.post('/orders/:id/approve', requirePermission('order.approve'), wrap(staff_order.approve));
router.post('/orders/:id/cancel', requirePermission('order.cancel'), wrap(staff_order.cancel));

const staff_invoice = require('../controllers/staff/invoice.controller');

router.get('/invoices', requirePermission('invoice.view'), wrap(staff_invoice.index));
router.get('/invoices/:id', requirePermission('invoice.view'), wrap(staff_invoice.show));
router.get('/invoices/:id/print', requirePermission('invoice.print'), wrap(staff_invoice.print));

const staff_report = require('../controllers/staff/report.controller');

router.get('/reports', requirePermission('report.view'), wrap(staff_report.index));
router.get('/reports/products', requirePermission('report.view'), wrap(staff_report.products));

const staff_warranty = require('../controllers/staff/warranty.controller');

router.get('/warranty', requirePermission('warranty.view'), wrap(staff_warranty.lookup));

module.exports = router;
