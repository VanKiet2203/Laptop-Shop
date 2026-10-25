// Chống CSRF: với request làm thay đổi dữ liệu (POST/PUT/PATCH/DELETE), trình duyệt luôn gửi header Origin (hoặc Referer)
// của trang gửi form. Nếu nó không cùng máy chủ với website thì từ chối. Kết hợp cookie SameSite=Lax (xem app.js).
// Request không có cả Origin lẫn Referer (curl, script, trình duyệt rất cũ) được cho qua vì không thể là form từ trang khác.
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(value) {
  try { return new URL(value).host; } catch (e) { return null; }
}

module.exports = (allowedHosts = () => []) => (req, res, next) => {
  if (!UNSAFE.has(req.method)) return next();
  const source = req.get('Origin') || req.get('Referer');
  if (!source || source === 'null' && !req.get('Origin')) return next();
  const host = hostOf(source);
  const allowed = new Set([req.get('Host'), ...allowedHosts()].filter(Boolean));
  if (host && allowed.has(host)) return next();
  console.warn(`[csrf] Chặn ${req.method} ${req.originalUrl} từ nguồn lạ: ${source}`);
  const wantsJson = req.get('X-Requested-With') === 'fetch' || /json/.test(req.get('Accept') || '');
  if (wantsJson) return res.status(403).json({ ok: false, error: 'Yêu cầu bị từ chối (nguồn không hợp lệ).' });
  return res.status(403).render('errors/403', { layout: 'layouts/store', title: 'Yêu cầu bị từ chối' });
};
