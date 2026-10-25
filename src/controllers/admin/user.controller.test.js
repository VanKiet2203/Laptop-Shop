const assert = require('node:assert/strict');
const test = require('node:test');
const Account = require('../../models/account.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./user.controller');

const targets = [[Account, 'findUserById'], [Account, 'countOtherActiveAdmins'], [Account, 'setActive'], [Account, 'removeUser'], [Account, 'updateUser'],
  [Account, 'roleOptions'], [Account, 'usernameOrEmailTaken'], [audit, 'logInTransaction'], [audit, 'log'], [db, 'transaction']];
const saved = [];
let calls;
test.beforeEach(() => {
  saved.length = 0; calls = [];
  for (const [o, k] of targets) saved.push([o, k, o[k]]);
  db.transaction = async (fn) => fn({ query: async () => [] });
  audit.logInTransaction = async () => {};
  audit.log = async () => {};
  Account.setActive = async (...a) => calls.push(['setActive', a[0], a[1]]);
  Account.removeUser = async () => { calls.push(['removeUser']); return true; };
  Account.updateUser = async () => calls.push(['updateUser']);
  Account.roleOptions = async () => [{ RoleId: 1, RoleCode: 'ADMIN' }, { RoleId: 2, RoleCode: 'SALES' }, { RoleId: 4, RoleCode: 'CUSTOMER' }];
  Account.usernameOrEmailTaken = async () => null;
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

const user = (o) => ({ AccountId: 20, Username: 'u20', IsActive: 1, RoleId: 2, RoleCode: 'SALES', FullName: 'U', ...o });
function http({ params = {}, body = {}, accountId = 1 } = {}) {
  const flashes = [];
  const req = { params, body, query: {}, session: { user: { accountId } }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('you cannot lock, delete or re-role your own account', async () => {
  Account.findUserById = async () => user({ AccountId: 1, RoleCode: 'ADMIN', RoleId: 1 });
  Account.countOtherActiveAdmins = async () => 5;
  const t = http({ params: { id: '1' } });
  await controller.toggleActive(t.req, t.res);
  assert.match(t.flashes[0][1], /tự khoá/);
  const d = http({ params: { id: '1' } });
  await controller.remove(d.req, d.res);
  assert.match(d.flashes[0][1], /chính mình/);
  const u = http({ params: { id: '1' }, body: { fullName: 'A', roleId: '2' } });
  await controller.update(u.req, u.res);
  assert.match(u.flashes[0][1], /tự thay đổi vai trò/);
  assert.equal(calls.length, 0);
});

test('the last active admin cannot be locked, deleted or demoted', async () => {
  Account.findUserById = async () => user({ AccountId: 30, RoleCode: 'ADMIN', RoleId: 1 });
  Account.countOtherActiveAdmins = async () => 0;
  const t = http({ params: { id: '30' } });
  await controller.toggleActive(t.req, t.res);
  assert.match(t.flashes[0][1], /cuối cùng/);
  const d = http({ params: { id: '30' } });
  await controller.remove(d.req, d.res);
  assert.match(d.flashes[0][1], /cuối cùng/);
  const u = http({ params: { id: '30' }, body: { fullName: 'A', roleId: '2' } });
  await controller.update(u.req, u.res);
  assert.match(u.flashes[0][1], /cuối cùng/);
  assert.equal(calls.length, 0);
});

test('a normal user can be locked and unlocked', async () => {
  Account.findUserById = async () => user({ IsActive: 1 });
  const t = http({ params: { id: '20' } });
  await controller.toggleActive(t.req, t.res);
  assert.deepEqual(calls[0], ['setActive', 20, false]);
  Account.findUserById = async () => user({ IsActive: 0 });
  await controller.toggleActive(http({ params: { id: '20' } }).req, t.res);
  assert.deepEqual(calls[1], ['setActive', 20, true]);
});

test('the system account NV000 is untouchable', async () => {
  Account.findUserById = async () => user({ EmployeeCode: 'NV000' });
  for (const action of ['toggleActive', 'remove', 'resetPassword']) {
    const h = http({ params: { id: '20' } });
    await controller[action](h.req, h.res);
    assert.equal(h.flashes[0][0], 'danger', action);
  }
  const u = http({ params: { id: '20' }, body: { fullName: 'A', roleId: '2' } });
  await controller.update(u.req, u.res);
  assert.match(u.flashes[0][1], /hệ thống/);
  assert.equal(calls.length, 0);
});

test('deleting a user that has data (FK 547) locks the account instead of failing', async () => {
  Account.findUserById = async () => user();
  Account.removeUser = async () => { throw Object.assign(new Error('FK'), { number: 547 }); };
  const h = http({ params: { id: '20' } });
  await controller.remove(h.req, h.res);
  assert.deepEqual(calls[0], ['setActive', 20, false]);
  assert.equal(h.flashes[0][0], 'warning');
});

test('creating a user validates username, password length and role', async () => {
  for (const body of [{ username: 'a', password: 'abcdef', fullName: 'X', roleId: '2' }, { username: 'good_name', password: '123', fullName: 'X', roleId: '2' },
    { username: 'good_name', password: 'abcdef', fullName: '', roleId: '2' }, { username: 'good_name', password: 'abcdef', fullName: 'X', roleId: '99' },
    { username: 'good_name', password: 'abcdef', fullName: 'X', roleId: '2', phone: '123' }]) {
    const h = http({ body });
    await controller.create(h.req, h.res);
    assert.equal(h.res.statusCode, 400, JSON.stringify(body));
  }
});
