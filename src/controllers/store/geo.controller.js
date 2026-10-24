// GET /api/geo/wards?province=... - phường/xã của một tỉnh (lấy từ API địa giới, server có cache) cho ô chọn ở form địa chỉ
const geo = require('../../core/geo');

exports.wards = async (req, res) => {
  const province = typeof req.query.province === 'string' ? req.query.province.trim() : '';
  const wards = province ? await geo.wardsOf(province) : null;
  res.set('Cache-Control', 'public, max-age=3600');
  // wards = null: API địa giới đang không tải được -> trình duyệt chuyển sang cho nhập tay
  res.json({ province, wards });
};
