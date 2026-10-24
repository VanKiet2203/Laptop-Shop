// Gửi email (xác nhận đơn hàng, gửi lại mã đơn). Cấu hình SMTP trong .env:
//   SMTP_HOST, SMTP_PORT (587/465), SMTP_SECURE (true nếu 465), SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL
// Chưa cấu hình SMTP (môi trường phát triển/đồ án): email KHÔNG gửi đi thật mà được lưu thành file HTML trong thư mục
// outbox/ ở gốc dự án (và in một dòng ra console) để vẫn xem và kiểm tra được nội dung.
// sendMail không bao giờ ném lỗi: lỗi gửi mail không được làm hỏng việc đặt hàng.
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const site = require('./siteInfo');

const OUTBOX = path.join(__dirname, '..', '..', 'outbox');
let transport = null;

const isConfigured = () => Boolean(process.env.SMTP_HOST);
const baseUrl = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/** @returns {Promise<{sent:boolean, mode:'smtp'|'outbox'|'error', file?:string}>} */
async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM || `"${site.name}" <${site.email}>`;
  try {
    if (isConfigured()) {
      await getTransport().sendMail({ from, to, subject, html, text });
      return { sent: true, mode: 'smtp' };
    }
    await fs.mkdir(OUTBOX, { recursive: true });
    const safeTo = String(to).replace(/[^a-z0-9@._-]/gi, '_').slice(0, 80);
    const file = `${Date.now()}-${safeTo}.html`;
    const header = `<!--\nTo: ${String(to).replace(/-->/g, '')}\nSubject: ${String(subject).replace(/-->/g, '')}\n-->\n`;
    await fs.writeFile(path.join(OUTBOX, file), header + html);
    console.log(`[mail] Chưa cấu hình SMTP - đã lưu email "${subject}" (gửi tới ${to}) vào outbox/${file}`);
    return { sent: false, mode: 'outbox', file };
  } catch (error) {
    console.error('[mail] Gửi email lỗi:', error.message);
    return { sent: false, mode: 'error' };
  }
}

module.exports = { sendMail, isConfigured, baseUrl, OUTBOX };
