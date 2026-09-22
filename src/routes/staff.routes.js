// KHU VỰC NHÂN VIÊN BÁN HÀNG (mount: /staff) - dùng chung layout & phân quyền, gộp route của 2 module
const router = require('express').Router();
const { requireRole } = require('../core/auth');
const { useLayout } = require('../core/locals');

router.use(requireRole('SALES'), useLayout('layouts/staff'));

router.use('/', require('./staff-sales.routes'));    // MODULE 4: tổng quan, đơn hàng, hoá đơn, báo cáo, bảo hành
router.use('/', require('./staff-catalog.routes'));  // MODULE 2: sản phẩm, danh mục, thương hiệu, thuộc tính

module.exports = router;
