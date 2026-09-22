/**
 * Kết nối SQL Server + hàm truy vấn dùng chung cho mọi Model.
 *   const db = require('../config/db');
 *   const rows = await db.query('SELECT * FROM Products WHERE ProductId = @id', { id: 5 });
 *   const one  = await db.queryOne('SELECT ...', { ... });
 *   const r    = await db.exec('sp_ApproveOrder', { OrderId: 1, AccountId: 2 });          // gọi stored procedure
 *   const out  = await db.exec('sp_PlaceOrderFromCart', {...}, { OrderId: db.sql.Int });  // có OUTPUT
 *   await db.transaction(async (t) => { await t.query('INSERT ...', {...}); ... });
 * Tham số có thể là giá trị thường (tự đoán kiểu) hoặc { type: db.sql.NVarChar(100), value: 'abc' }.
 */
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'LaptopShopDB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};
if (process.env.DB_INSTANCE) config.options.instanceName = process.env.DB_INSTANCE;
else config.port = parseInt(process.env.DB_PORT || '1433', 10);

let poolPromise;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null; // cho phép thử lại lần sau
      throw err;
    });
  }
  return poolPromise;
}

function bind(request, params = {}) {
  for (const [name, val] of Object.entries(params)) {
    if (val && typeof val === 'object' && 'type' in val && 'value' in val) request.input(name, val.type, val.value);
    else request.input(name, val === undefined ? null : val);
  }
  return request;
}

async function query(text, params) {
  const pool = await getPool();
  const result = await bind(pool.request(), params).query(text);
  return result.recordset || [];
}

async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/** Gọi stored procedure. outputs = { TênThamSố: kiểuSql } -> trả về result.output */
async function exec(procName, inputs = {}, outputs = {}) {
  const pool = await getPool();
  const request = bind(pool.request(), inputs);
  for (const [name, type] of Object.entries(outputs)) request.output(name, type);
  const result = await request.execute(procName);
  return { rows: result.recordset || [], output: result.output || {} };
}

async function transaction(work) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const t = {
      query: async (text, params) => (await bind(new sql.Request(tx), params).query(text)).recordset || [],
      exec: async (proc, inputs = {}, outputs = {}) => {
        const rq = bind(new sql.Request(tx), inputs);
        for (const [n, ty] of Object.entries(outputs)) rq.output(n, ty);
        const r = await rq.execute(proc);
        return { rows: r.recordset || [], output: r.output || {} };
      },
    };
    const out = await work(t);
    await tx.commit();
    return out;
  } catch (e) {
    try { await tx.rollback(); } catch (_) { /* đã rollback */ }
    throw e;
  }
}

module.exports = { sql, getPool, query, queryOne, exec, transaction };
