const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../config/db');
const SqlSessionStore = require('./sqlSessionStore');

const realQuery = db.query;
const realQueryOne = db.queryOne;
let store, sqls;
test.beforeEach(() => {
  sqls = [];
  db.query = async (sql, params) => { sqls.push({ sql, params }); return []; };
  db.queryOne = async (sql, params) => { sqls.push({ sql, params }); return null; };
  store = new SqlSessionStore({ sweepMs: 1e9 });
});
test.afterEach(() => { db.query = realQuery; db.queryOne = realQueryOne; clearInterval(store.sweepTimer); });

const call = (fn, ...args) => new Promise((resolve, reject) => fn.call(store, ...args, (err, v) => (err ? reject(err) : resolve(v))));

test('set stores the session as JSON with an expiry taken from the cookie', async () => {
  const exp = new Date(Date.now() + 3600 * 1000);
  await call(store.set, 'sid1', { user: { accountId: 1 }, cookie: { expires: exp.toISOString() } });
  assert.equal(JSON.parse(sqls[0].params.data).user.accountId, 1);
  assert.equal(sqls[0].params.expires.getTime(), exp.getTime());
  assert.match(sqls[0].sql, /MERGE dbo\.Sessions/);
});

test('get returns the parsed session, null for missing/expired, and null (not a crash) for corrupt JSON', async () => {
  db.queryOne = async () => ({ Data: '{"a":1}' });
  assert.deepEqual(await call(store.get, 'x'), { a: 1 });
  db.queryOne = async (sql) => { assert.match(sql, /ExpiresAt > SYSDATETIME\(\)/); return null; };
  assert.equal(await call(store.get, 'x'), null);
  db.queryOne = async () => ({ Data: '{not json' });
  assert.equal(await call(store.get, 'x'), null);
});

test('database errors are passed to express-session instead of being swallowed', async () => {
  db.queryOne = async () => { throw Object.assign(new Error('db down'), { name: 'ConnectionError' }); };
  await assert.rejects(call(store.get, 'x'), /db down/);
});

test('touch extends the expiry, destroy deletes, sweep removes expired rows', async () => {
  await call(store.touch, 'sid', { cookie: {} });
  assert.match(sqls[0].sql, /UPDATE dbo\.Sessions SET ExpiresAt/);
  await call(store.destroy, 'sid');
  assert.match(sqls[1].sql, /DELETE FROM dbo\.Sessions WHERE SessionId/);
  await store.sweep();
  assert.match(sqls[2].sql, /ExpiresAt <= SYSDATETIME/);
});
