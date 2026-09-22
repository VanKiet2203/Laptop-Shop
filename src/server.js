require('dotenv').config();
const app = require('./app');
const { getPool } = require('./config/db');

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  try {
    await getPool();
    console.log('Kết nối SQL Server: OK');
  } catch (e) {
    console.error('Kết nối SQL Server THẤT BẠI:', e.message);
    console.error('-> Kiểm tra file .env và đã chạy 3 file SQL trong thư mục database/ chưa.');
  }
});
