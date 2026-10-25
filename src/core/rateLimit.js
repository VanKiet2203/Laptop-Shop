// Giới hạn tần suất trong bộ nhớ (cửa sổ trượt) - chống dò mật khẩu, spam đơn / email / chat.
// Lưu theo tiến trình nên khởi động lại server thì bộ đếm về 0 (đủ cho đồ án; chạy nhiều tiến trình cần Redis).
const buckets = new Map(); // key -> mảng mốc thời gian (ms)
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < 60 * 1000) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (!entry.times.length || now - entry.times[entry.times.length - 1] > entry.windowMs) buckets.delete(key);
  }
}

function recent(key, windowMs, now = Date.now()) {
  const entry = buckets.get(key) || { times: [], windowMs };
  entry.windowMs = windowMs;
  entry.times = entry.times.filter((t) => now - t < windowMs);
  buckets.set(key, entry);
  return entry;
}

/** Số lần đã ghi nhận trong cửa sổ (không tính thêm). */
exports.count = (key, windowMs) => recent(key, windowMs).times.length;

/** Ghi nhận một lần; trả về { allowed, count, retryAfterSec } so với `max`. */
exports.hit = (key, max, windowMs) => {
  const now = Date.now();
  sweep(now);
  const entry = recent(key, windowMs, now);
  if (entry.times.length >= max) {
    return { allowed: false, count: entry.times.length, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - entry.times[0])) / 1000)) };
  }
  entry.times.push(now);
  return { allowed: true, count: entry.times.length, retryAfterSec: 0 };
};

/** Xoá bộ đếm (vd: đăng nhập thành công thì bỏ đếm số lần sai). */
exports.reset = (key) => buckets.delete(key);

exports._clear = () => buckets.clear();

/**
 * Middleware giới hạn theo IP. Vượt ngưỡng -> 429 (JSON nếu là request fetch/API, trang thông báo nếu là trang thường).
 *   router.post('/login', rateLimit.byIp('login', 30, 15 * 60 * 1000), ...)
 */
exports.byIp = (name, max, windowMs, message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.') => (req, res, next) => {
  const r = exports.hit(`${name}:ip:${req.ip}`, max, windowMs);
  if (r.allowed) return next();
  res.set('Retry-After', String(r.retryAfterSec));
  const wantsJson = req.get('X-Requested-With') === 'fetch' || /json/.test(req.get('Accept') || '') || /^\/(api|chat)\b/.test(req.path);
  if (wantsJson) return res.status(429).json({ ok: false, error: message, retryAfter: r.retryAfterSec });
  return res.status(429).render('errors/429', { layout: 'layouts/store', title: 'Thao tác quá nhanh', message, retryAfter: r.retryAfterSec });
};
