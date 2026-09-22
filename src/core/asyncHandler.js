// Bọc controller async để lỗi tự chuyển tới error handler:  router.get('/', wrap(ctrl.index))
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
