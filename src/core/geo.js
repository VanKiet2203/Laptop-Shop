// Tỉnh/thành + phường/xã lấy từ API công khai provinces.open-api.vn (v2, sau sáp nhập 2025: chỉ còn 2 cấp).
// Server giữ cache trong bộ nhớ 24 giờ để không gọi API mỗi request; API lỗi thì dùng cache cũ,
// chưa từng tải được thì dùng danh sách tỉnh dự phòng (provinces.js) và KHÔNG ép kiểm tra phường/xã.
const FALLBACK_PROVINCES = require('./provinces');

const API_URL = process.env.GEO_API_URL || 'https://provinces.open-api.vn/api/v2/?depth=2';
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

let cache = null;      // { loadedAt, provinces: [name], wards: Map<name, string[]> }
let loading = null;
let lastFailAt = 0;

// API trả "Thành phố Hà Nội" / "Tỉnh Cao Bằng"; cửa hàng lưu dạng "TP. Hà Nội" / "Cao Bằng" như các địa chỉ cũ.
const shortName = (n) => String(n).normalize('NFC').replace(/^Thành phố\s+/, 'TP. ').replace(/^Tỉnh\s+/, '');

async function fetchAll() {
  const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geo API ${res.status}`);
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) throw new Error('Geo API trả dữ liệu rỗng');
  const wards = new Map();
  list.forEach((p) => wards.set(shortName(p.name), (p.wards || []).map((w) => String(w.name).normalize('NFC')).sort((a, b) => a.localeCompare(b, 'vi'))));
  return { loadedAt: Date.now(), provinces: [...wards.keys()], wards };
}

async function ensureLoaded() {
  const fresh = cache && Date.now() - cache.loadedAt < TTL_MS;
  if (fresh || (cache === null && Date.now() - lastFailAt < RETRY_MS) || (cache && Date.now() - lastFailAt < RETRY_MS && lastFailAt > cache.loadedAt)) return cache;
  if (!loading) {
    loading = fetchAll()
      .then((c) => { cache = c; })
      .catch((e) => { lastFailAt = Date.now(); console.error('Không tải được danh sách địa giới:', e.message); })
      .finally(() => { loading = null; });
  }
  await loading;
  return cache;
}

/** Danh sách tỉnh/thành (API; dự phòng khi chưa tải được). */
exports.provinces = async () => (await ensureLoaded())?.provinces || FALLBACK_PROVINCES;

/** Phường/xã của một tỉnh; null nếu chưa có dữ liệu từ API. */
exports.wardsOf = async (province) => (await ensureLoaded())?.wards.get(province) || null;

/** Kiểm tra cặp tỉnh + phường/xã; trả về chuỗi lỗi hoặc null nếu hợp lệ. */
exports.validate = async (province, ward) => {
  const c = await ensureLoaded();
  if (!c) return province && FALLBACK_PROVINCES.includes(province) ? (ward ? null : 'Vui lòng nhập phường/xã.') : 'Tỉnh/Thành phố không hợp lệ.';
  if (!c.wards.has(province)) return 'Tỉnh/Thành phố không hợp lệ.';
  if (!ward) return 'Vui lòng chọn phường/xã.';
  return c.wards.get(province).includes(ward) ? null : 'Phường/Xã không thuộc tỉnh/thành phố đã chọn.';
};

exports._reset = () => { cache = null; loading = null; lastFailAt = 0; };
