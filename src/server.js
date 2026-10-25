require('dotenv').config();
const app = require('./app');
const db = require('./config/db');
const chatAi = require('./core/chatAi');

const PORT = process.env.PORT || 3000;

// Đơn "Đang kiểm tra hàng" quá hạn thì tự huỷ để nhả hàng giữ chỗ
async function expirePendingOrders() {
  // Mặc định: BẬT 48 giờ khi NODE_ENV=production, TẮT khi phát triển (để đơn chờ mẫu trong DB demo không tự biến mất). Đặt PENDING_HOLD_HOURS để chọn số giờ, 0 = tắt.
  const raw = process.env.PENDING_HOLD_HOURS;
  const hours = raw !== undefined && raw !== '' ? Number(raw) : (process.env.NODE_ENV === 'production' ? 48 : 0);
  if (!Number.isFinite(hours) || hours < 1) return;
  try {
    const r = await db.exec('sp_ExpirePendingOrders', { Hours: hours }, { Cancelled: db.sql.Int });
    if (r.output.Cancelled) console.log(`[đơn hàng] Đã tự huỷ ${r.output.Cancelled} đơn chờ quá ${hours} giờ và nhả hàng giữ chỗ.`);
  } catch (e) {
    console.error('[đơn hàng] Tự huỷ đơn quá hạn lỗi:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  try {
    await db.getPool();
    console.log('Kết nối SQL Server: OK');
    expirePendingOrders();
    setInterval(expirePendingOrders, 30 * 60 * 1000).unref();
    chatAi.start();
  } catch (e) {
    console.error('Kết nối SQL Server THẤT BẠI:', e.message);
    console.error('-> Kiểm tra file .env và đã chạy 3 file SQL trong thư mục database/ chưa.');
  }
});
