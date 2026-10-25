// NV BÁN HÀNG: hộp thư chat với khách   (mount: /staff, cùng layout & vai trò SALES - xem staff.routes.js)
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const { requirePermission } = require('../core/auth');
const chat = require('../controllers/staff/chat.controller');

const need = requirePermission('chat.reply');

router.get('/chat', need, wrap(chat.index));
router.get('/chat/api/list', need, wrap(chat.list));
router.get('/chat/api/unread', need, wrap(chat.unread));
router.get('/chat/api/:id/messages', need, wrap(chat.messages));
router.post('/chat/api/:id/send', need, wrap(chat.send));
router.post('/chat/api/:id/claim', need, wrap(chat.claim));
router.post('/chat/api/:id/status', need, wrap(chat.status));
router.post('/chat/api/:id/ai', need, wrap(chat.ai));

module.exports = router;
