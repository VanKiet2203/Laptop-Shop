// Lưu session trong SQL Server (bảng dbo.Sessions) thay cho MemoryStore: khởi động lại server không làm mất đăng nhập / giỏ hàng,
// và không rò bộ nhớ khi có nhiều phiên. Đặt SESSION_STORE=memory trong .env để quay lại bộ nhớ (vd khi chưa chạy file 01_schema.sql mới).
const session = require('express-session');
const db = require('../config/db');

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 8;

class SqlSessionStore extends session.Store {
  constructor({ ttlMs = DEFAULT_TTL_MS, sweepMs = 15 * 60 * 1000 } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.sweepTimer = setInterval(() => this.sweep().catch((e) => console.error('[session] Dọn phiên hết hạn lỗi:', e.message)), sweepMs);
    this.sweepTimer.unref();
  }

  expiresAt(sess) {
    const fromCookie = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : 0;
    return new Date(fromCookie > Date.now() ? fromCookie : Date.now() + this.ttlMs);
  }

  get(sid, cb) {
    db.queryOne('SELECT Data FROM dbo.Sessions WHERE SessionId = @sid AND ExpiresAt > SYSDATETIME()', { sid })
      .then((row) => {
        if (!row) return null;
        try { return JSON.parse(row.Data); } catch (e) { return null; } // phiên hỏng coi như không có -> khách đăng nhập lại
      })
      .then((data) => cb(null, data), (e) => cb(e));
  }

  set(sid, sess, cb) {
    db.query(
      `MERGE dbo.Sessions AS t USING (SELECT @sid AS SessionId) AS s ON t.SessionId = s.SessionId
       WHEN MATCHED THEN UPDATE SET Data = @data, ExpiresAt = @expires
       WHEN NOT MATCHED THEN INSERT (SessionId, Data, ExpiresAt) VALUES (@sid, @data, @expires);`,
      { sid, data: JSON.stringify(sess), expires: this.expiresAt(sess) })
      .then(() => cb && cb(null)).catch((e) => cb && cb(e));
  }

  touch(sid, sess, cb) {
    db.query('UPDATE dbo.Sessions SET ExpiresAt = @expires WHERE SessionId = @sid', { sid, expires: this.expiresAt(sess) })
      .then(() => cb && cb(null)).catch((e) => cb && cb(e));
  }

  destroy(sid, cb) {
    db.query('DELETE FROM dbo.Sessions WHERE SessionId = @sid', { sid })
      .then(() => cb && cb(null)).catch((e) => cb && cb(e));
  }

  async sweep() {
    await db.query('DELETE FROM dbo.Sessions WHERE ExpiresAt <= SYSDATETIME()');
  }
}

module.exports = SqlSessionStore;
