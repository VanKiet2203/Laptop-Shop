// Bảng phân tuyến tổng. Mỗi module tự quản lý file routes của mình.
const router = require('express').Router();

router.use('/auth', require('./auth.routes'));            // Đăng nhập/đăng xuất        (M1)
router.use('/admin', require('./admin.routes'));          // Giao diện ADMIN            (M1)
router.use('/warehouse', require('./warehouse.routes'));  // Giao diện KHO / nhập hàng  (M1)
router.use('/staff', require('./staff.routes'));          // Giao diện NV BÁN HÀNG      (M2 + M4)
router.use('/', require('./customer.routes'));            // /register /cart /checkout /account /orders (M3)
router.use('/', require('./store.routes'));               // Cửa hàng: / /products      (M2)

module.exports = router;
