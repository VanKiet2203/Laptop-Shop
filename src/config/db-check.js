require('dotenv').config();
const db = require('./db');
(async () => {
  try {
    const r = await db.queryOne('SELECT DB_NAME() AS db, (SELECT COUNT(*) FROM dbo.Products) AS products, (SELECT COUNT(*) FROM dbo.Accounts) AS accounts');
    console.log('OK', r);
  } catch (e) { console.error('LỖI:', e.message); }
  process.exit(0);
})();
