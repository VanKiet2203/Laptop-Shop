// express-session gửi phản hồi (kể cả Location của redirect) TRƯỚC khi kho session ghi xong. Với MemoryStore (ghi đồng bộ) thì không sao,
// nhưng với kho SQL, trình duyệt có thể gọi trang kế tiếp trước khi phiên mới (vừa đăng nhập, vừa thêm giỏ hàng...) được ghi ->
// request sau không thấy phiên. Middleware này: nếu phiên đã thay đổi trong request thì GHI XONG rồi mới gửi phản hồi.
// Phiên không đổi thì không ghi thêm gì (không tốn lệnh SQL).
module.exports = (req, res, next) => {
  if (!req.session) return next();
  const snapshot = JSON.stringify(req.session);
  const dirty = () => req.session && typeof req.session.save === 'function' && JSON.stringify(req.session) !== snapshot;

  const wrap = (name) => {
    const original = res[name];
    res[name] = function saveThenSend(...args) {
      if (!dirty()) return original.apply(this, args);
      const self = this;
      req.session.save((err) => {
        if (err) console.error('[session] Ghi phiên lỗi:', err.message);
        original.apply(self, args);
      });
      return this;
    };
  };
  wrap('redirect');
  wrap('send'); // res.json / res.render / res.sendStatus đều đi qua res.send
  next();
};
