const assert = require('node:assert/strict');
const test = require('node:test');
const Chat = require('../../models/chat.model');
const rateLimit = require('../../core/rateLimit');
const controller = require('./chat.controller');

const keys = ['findById', 'findForCustomer', 'create', 'claimGuest', 'mergeGuest', 'setProduct', 'addMessage', 'messagesAfter', 'markCustomerRead', 'unreadForCustomer', 'requestHuman'];
const saved = {};
let created, added, humans;
test.beforeEach(() => {
  rateLimit._clear(); created = []; added = []; humans = [];
  for (const k of keys) saved[k] = Chat[k];
  Chat.create = async (d) => { created.push(d); return 41; };
  Chat.findById = async (id) => (id === 41 ? { ConversationId: 41, CustomerId: null, Status: 'Open', NeedsHuman: 0 } : id === 99 ? { ConversationId: 99, CustomerId: 5, Status: 'Open' } : null);
  Chat.setProduct = async () => {};
  Chat.addMessage = async (id, type, body) => { added.push([id, type, body]); return { MessageId: 100 + added.length, SenderType: type, Body: body, SenderName: 'x', CreatedAt: new Date() }; };
  Chat.messagesAfter = async () => [];
  Chat.markCustomerRead = async () => {};
  Chat.unreadForCustomer = async () => 2;
  Chat.requestHuman = async (id) => humans.push(id);
  Chat.findForCustomer = async () => null;
  Chat.claimGuest = async () => {};
});
test.afterEach(() => { for (const k of keys) Chat[k] = saved[k]; });

function http({ body = {}, query = {}, session = {} } = {}) {
  const req = { body, query, ip: '1.1.1.1', session: { ...session } };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return { req, res };
}

test('a guest message creates a conversation bound to the SESSION, with a sanitised name', async () => {
  const h = http({ body: { body: '  Xin chào  ', guestName: ' <b>An</b>\u0007 ' } });
  await controller.send(h.req, h.res);
  assert.equal(h.res.body.ok, true);
  assert.equal(created[0].customerId, null);
  assert.equal(created[0].guestName, 'bAn/b'.replace('/', '/')); // ký tự < > và điều khiển bị loại
  assert.equal(h.req.session.chatConversationId, 41);
  assert.deepEqual(added[0], [41, 'Customer', 'Xin chào']);
});

test('a logged-in customer chats under their account (no guest name)', async () => {
  const h = http({ body: { body: 'hi' }, session: { user: { role: 'CUSTOMER', customerId: 5 } } });
  await controller.send(h.req, h.res);
  assert.equal(created[0].customerId, 5);
  assert.equal(created[0].guestName, null);
});

test('validation: empty, too long, and rapid-fire messages are refused', async () => {
  const empty = http({ body: { body: '   ' } });
  await controller.send(empty.req, empty.res);
  assert.equal(empty.res.statusCode, 400);
  const long = http({ body: { body: 'x'.repeat(1001) } });
  await controller.send(long.req, long.res);
  assert.equal(long.res.statusCode, 400);
  const fast = http({ body: { body: 'a' }, session: { chatLastSend: Date.now() } });
  await controller.send(fast.req, fast.res);
  assert.equal(fast.res.statusCode, 429);
  assert.equal(added.length, 0);
});

test('per-IP message flood is limited', async () => {
  let blocked = 0;
  for (let i = 0; i < 35; i += 1) {
    const h = http({ body: { body: 'spam ' + i } });
    await controller.send(h.req, h.res);
    if (h.res.statusCode === 429) blocked += 1;
  }
  assert.equal(blocked, 5);
});

test('conversation id is NEVER taken from the request: a guest cannot read or write somebody else\'s conversation', async () => {
  // Phiên không có chatConversationId, dù query/body cố nhét id của người khác
  const h = http({ query: { id: '99', conversationId: '99' }, body: { conversationId: 99, body: 'hello' } });
  await controller.state(h.req, h.res);
  assert.equal(h.res.body.conversation, null);
  // Phiên trỏ vào hội thoại đã thuộc về một khách có tài khoản -> không dùng được
  const stolen = http({ session: { chatConversationId: 99 } });
  await controller.state(stolen.req, stolen.res);
  assert.equal(stolen.res.body.conversation, null);
});

test('state returns new messages, marks read only when the panel is open, and reports unread otherwise', async () => {
  Chat.messagesAfter = async () => [{ MessageId: 5, SenderType: 'AI', Body: 'chào', SenderName: 'Trợ lý AI', CreatedAt: new Date() }];
  let read = 0; Chat.markCustomerRead = async () => { read += 1; };
  const open = http({ query: { open: '1', after: '0' }, session: { chatConversationId: 41 } });
  await controller.state(open.req, open.res);
  assert.equal(open.res.body.messages[0].sender, 'AI');
  assert.equal(open.res.body.unread, 0);
  assert.equal(read, 1);
  const closed = http({ query: { after: '0' }, session: { chatConversationId: 41 } });
  await controller.state(closed.req, closed.res);
  assert.equal(closed.res.body.unread, 2);
  assert.equal(read, 1);
});

test('staff/admin accounts cannot use the customer widget API', async () => {
  const h = http({ body: { body: 'x' }, session: { user: { role: 'SALES' } } });
  await controller.send(h.req, h.res);
  assert.equal(h.res.statusCode, 403);
  const s = http({ session: { user: { role: 'ADMIN' } } });
  await controller.state(s.req, s.res);
  assert.equal(s.res.statusCode, 403);
});

test('"Gặp nhân viên" needs an existing conversation, flags it once and posts an AI notice', async () => {
  const none = http();
  await controller.human(none.req, none.res);
  assert.equal(none.res.statusCode, 400);

  const h = http({ session: { chatConversationId: 41 } });
  await controller.human(h.req, h.res);
  assert.deepEqual(humans, [41]);
  assert.equal(added[0][1], 'AI');
  assert.equal(h.res.body.ok, true);
});

test('a logged-in customer picks up the guest conversation started before logging in', async () => {
  let claimed;
  Chat.claimGuest = async (id, customerId) => { claimed = [id, customerId]; };
  let calls = 0;
  Chat.findForCustomer = async () => { calls += 1; return calls === 1 ? null : { ConversationId: 41, CustomerId: 5, Status: 'Open' }; };
  const h = http({ session: { user: { role: 'CUSTOMER', customerId: 5 }, chatConversationId: 41 } });
  await controller.state(h.req, h.res);
  assert.deepEqual(claimed, [41, 5]);
  assert.equal(h.res.body.conversation.id, 41);
});

test('a logged-in customer who already has a conversation gets the guest thread merged into it (not left orphaned)', async () => {
  let merged; let calls = 0;
  Chat.mergeGuest = async (guestId, targetId) => { merged = [guestId, targetId]; };
  Chat.findForCustomer = async () => { calls += 1; return { ConversationId: 50, CustomerId: 5, Status: 'Open' }; };
  const h = http({ session: { user: { role: 'CUSTOMER', customerId: 5 }, chatConversationId: 41 } });
  await controller.state(h.req, h.res);
  assert.deepEqual(merged, [41, 50]);
  assert.equal(h.res.body.conversation.id, 50);
  assert.equal(h.req.session.chatConversationId, 50);
  // lần sau (id trong phiên đã là hội thoại của khách) thì không gộp nữa
  merged = null;
  await controller.state(h.req, h.res);
  assert.equal(merged, null);
});
