// MODULE 1 - ADMIN   (mount: /admin)
// Chủ sở hữu file: Thành viên 1 - Hệ thống & Kho
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requireRole, requirePermission } = require('../core/auth');
const { useLayout } = require('../core/locals');

router.use(requireRole('ADMIN'), useLayout('layouts/admin'));

const admin_dashboard = require('../controllers/admin/dashboard.controller');

router.get('/', wrap(admin_dashboard.index));

const admin_user = require('../controllers/admin/user.controller');

router.get('/users', requirePermission('user.manage'), wrap(admin_user.index));
router.get('/users/new', requirePermission('user.manage'), wrap(admin_user.showCreate));
router.post('/users', requirePermission('user.manage'), wrap(admin_user.create));
router.get('/users/:id/edit', requirePermission('user.manage'), wrap(admin_user.showEdit));
router.post('/users/:id', requirePermission('user.manage'), wrap(admin_user.update));
router.post('/users/:id/toggle', requirePermission('user.manage'), wrap(admin_user.toggleActive));
router.post('/users/:id/reset-password', requirePermission('user.manage'), wrap(admin_user.resetPassword));
router.post('/users/:id/delete', requirePermission('user.manage'), wrap(admin_user.remove));

const admin_role = require('../controllers/admin/role.controller');

router.get('/roles', requirePermission('role.manage'), wrap(admin_role.index));
router.get('/roles/:id/permissions', requirePermission('role.manage'), wrap(admin_role.showPermissions));
router.post('/roles/:id/permissions', requirePermission('role.manage'), wrap(admin_role.savePermissions));

const admin_audit = require('../controllers/admin/audit.controller');

router.get('/audit-logs', requirePermission('audit.view'), wrap(admin_audit.index));

module.exports = router;
