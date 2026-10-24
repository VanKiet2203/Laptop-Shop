const assert = require('node:assert/strict');
const test = require('node:test');
const Role = require('../../models/role.model');
const audit = require('../../models/audit.model');
const db = require('../../config/db');
const controller = require('./role.controller');

const targets = [[Role, 'findById'], [Role, 'savePermissions'], [audit, 'logInTransaction'], [db, 'transaction']];
const saved = [];
test.beforeEach(() => {
  saved.length = 0;
  for (const [o, k] of targets) saved.push([o, k, o[k]]);
  audit.logInTransaction = async () => {};
  db.transaction = async (fn) => fn({});
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http(params, body) {
  const flashes = [];
  const req = { params, body, query: {}, session: { user: { accountId: 1 } }, flash: (...a) => flashes.push(a) };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, render(v, d) { this.rendered = { v, d }; return this; }, redirect(l) { this.redirected = l; return this; } };
  return { req, res, flashes };
}

test('permission ids from the form are de-duplicated and non-numeric values dropped before saving', async () => {
  Role.findById = async () => ({ RoleId: 2, RoleCode: 'SALES', RoleName: 'NV' });
  let got;
  Role.savePermissions = async (roleId, ids) => { got = [roleId, ids]; return ids.map((id) => ({ PermissionId: id, PermCode: `p.${id}` })); };
  const h = http({ id: '2' }, { permissionIds: ['3', '3', 'x', '7;DROP', '-1', '9'] });
  await controller.savePermissions(h.req, h.res);
  assert.deepEqual(got, [2, [3, 9]]);
  assert.equal(h.res.redirected, '/admin/roles');
  assert.equal(h.flashes[0][0], 'success');
});

test('a single checkbox (string, not array) and an empty form both work', async () => {
  Role.findById = async () => ({ RoleId: 3, RoleCode: 'WAREHOUSE', RoleName: 'Kho' });
  const seen = [];
  Role.savePermissions = async (roleId, ids) => { seen.push(ids); return []; };
  await controller.savePermissions(http({ id: '3' }, { permissionIds: '4' }).req, http({}, {}).res);
  await controller.savePermissions(http({ id: '3' }, {}).req, http({}, {}).res);
  assert.deepEqual(seen, [[4], []]);
});

test('the ADMIN role can never lose user.manage / role.manage (the whole change is rolled back)', async () => {
  Role.findById = async () => ({ RoleId: 1, RoleCode: 'ADMIN', RoleName: 'Admin' });
  Role.savePermissions = async () => [{ PermissionId: 1, PermCode: 'audit.view' }];
  const h = http({ id: '1' }, { permissionIds: ['1'] });
  await controller.savePermissions(h.req, h.res);
  assert.equal(h.flashes[0][0], 'danger');
  assert.match(h.flashes[0][1], /user\.manage/);
  assert.equal(h.res.redirected, '/admin/roles/1/permissions');
});

test('unknown role -> 404', async () => {
  Role.findById = async () => null;
  const h = http({ id: '99' }, {});
  await controller.savePermissions(h.req, h.res);
  assert.equal(h.res.statusCode, 404);
});
