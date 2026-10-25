// Chat phía khách (mount: /chat) - công khai, không cần đăng nhập; hội thoại gắn với phiên hoặc tài khoản khách hàng.
const router = require('express').Router();
const wrap = require('../core/asyncHandler');
const rateLimit = require('../core/rateLimit');
const chat = require('../controllers/store/chat.controller');

// trần chung theo IP (polling 3-20 giây/lần của khung chat vẫn nằm xa dưới mức này)
router.use(rateLimit.byIp('chat-api', 600, 10 * 60 * 1000, 'Bạn thao tác chat quá nhanh. Vui lòng thử lại sau ít phút.'));

router.get('/state', wrap(chat.state));
router.post('/send', wrap(chat.send));
router.post('/human', wrap(chat.human));

module.exports = router;
