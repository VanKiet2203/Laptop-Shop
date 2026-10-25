const assert = require('node:assert/strict');
const test = require('node:test');
const Chat = require('../../models/chat.model');
const audit = require('../../models/audit.model');
const controller = require('./chat.controller');

const keys = [[Chat, 'detailForStaff'], [Chat, 'addMessage'], [Chat, 'markStaffRead'], [Chat, 'messagesAfter'], [Chat, 'claim'], [Chat, 'setStatus'],
  [Chat, 'setAi'], [Chat, 'listForStaff'], [Chat, 'unreadConversationsForStaff'], [audit, 'log']];
const saved = [];
let log;
test.beforeEach(() => {
  saved.length = 0; log = [];
  for (const [o, k] of keys) saved.push([o, k, o[k]]);
  audit.log = async () => {};
  Chat.detailForStaff = async (id) => (id === 3 ? { ConversationId: 3, Status: 'Open', NeedsHuman: 1, AiEnabled: 1, CustomerName: 'Lan', CustomerId: 9, AssignedEmployeeId: 4, AssignedName: 'Duy' } : null);
  Chat.markStaffRead = async (id) => log.push(['read', id]);
  Chat.addMessage = async (id, type, body, emp) => { log.push(['add', id, type, body, emp]); return { MessageId: 77, SenderType: type, Body: body, SenderName: 'Duy', CreatedAt: new Date() }; };
  Chat.messagesAfter = async () => [];
  Chat.claim = async (...a) => log.push(['claim', ...a]);
  Chat.setStatus = async (...a) => log.push(['status', ...a]);
  Chat.setAi = async (...a) => log.push(['ai', ...a]);
});
test.afterEach(() => { for (const [o, k, v] of saved) o[k] = v; });

function http({ params = {}, body = {}, query = {} } = {}) {
  const req = { params, body, query, session: { user: { accountId: 1, employeeId: 4 } } };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, render(v, d) { this.rendered = { v, d }; return this; } };
  return { req, res };
}

test('staff replies are stored with the employee id, trimmed and length-checked', async () => {
  const h = http({ params: { id: '3' }, body: { body: '  Dạ em chào anh  ' } });
  await controller.send(h.req, h.res);
  assert.deepEqual(log.find((x) => x[0] === 'add'), ['add', 3, 'Staff', 'Dạ em chào anh', 4]);
  assert.equal(h.res.body.ok, true);

  const empty = http({ params: { id: '3' }, body: { body: ' ' } });
  await controller.send(empty.req, empty.res);
  assert.equal(empty.res.statusCode, 400);
  const long = http({ params: { id: '3' }, body: { body: 'x'.repeat(1001) } });
  await controller.send(long.req, long.res);
  assert.equal(long.res.statusCode, 400);
});

test('invalid or unknown conversation ids are 404 and never touch the database writes', async () => {
  for (const id of ['abc', '0', '-1', '1e3', '999']) {
    const h = http({ params: { id }, body: { body: 'hi' } });
    await controller.send(h.req, h.res);
    assert.equal(h.res.statusCode, 404, id);
  }
  assert.equal(log.length, 0);
});

test('opening a conversation marks it read by staff and tells whether it is assigned to me', async () => {
  const h = http({ params: { id: '3' } });
  await controller.messages(h.req, h.res);
  assert.ok(log.some((x) => x[0] === 'read' && x[1] === 3));
  assert.equal(h.res.body.conversation.assignedToMe, true);
  assert.equal(h.res.body.conversation.needsHuman, true);
});

test('claim, close/reopen and AI toggle call the model with whitelisted values', async () => {
  await controller.claim(http({ params: { id: '3' } }).req, http().res);
  assert.deepEqual(log.find((x) => x[0] === 'claim'), ['claim', 3, 4]);
  await controller.status(http({ params: { id: '3' }, body: { status: 'Closed' } }).req, http().res);
  await controller.status(http({ params: { id: '3' }, body: { status: 'DROP TABLE' } }).req, http().res);
  assert.deepEqual(log.filter((x) => x[0] === 'status').map((x) => x[2]), ['Closed', 'Open']);
  await controller.ai(http({ params: { id: '3' }, body: { enabled: '0' } }).req, http().res);
  await controller.ai(http({ params: { id: '3' }, body: { enabled: '1' } }).req, http().res);
  assert.deepEqual(log.filter((x) => x[0] === 'ai').map((x) => x[2]), [false, true]);
});

test('list and unread are shaped for the inbox script', async () => {
  Chat.listForStaff = async () => [{ ConversationId: 3, Status: 'Open', NeedsHuman: 1, AiEnabled: 1, Unread: 2, CustomerName: 'Lan', CustomerId: null, ProductName: null, AssignedName: null, Preview: 'hi', LastMessageAt: new Date() }];
  const l = http();
  await controller.list(l.req, l.res);
  assert.equal(l.res.body.conversations[0].unread, 2);
  assert.equal(l.res.body.conversations[0].isMember, false);
  Chat.unreadConversationsForStaff = async () => 5;
  const u = http();
  await controller.unread(u.req, u.res);
  assert.equal(u.res.body.count, 5);
});
