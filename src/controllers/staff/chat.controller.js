// NV BÁN HÀNG: hộp thư chat với khách. Trang /staff/chat (khung giao diện) + API JSON cho script trong trang.
// Quyền: chat.reply (xem routes/staff-chat.routes.js). Nhân viên chỉ gửi văn bản thuần; mọi nội dung hiển thị bằng textContent phía trình duyệt.
const Chat = require('../../models/chat.model');
const audit = require('../../models/audit.model');
const { parseId } = require('../../core/helpers');

const publicMessage = (m) => ({ id: m.MessageId, sender: m.SenderType, name: m.SenderName, body: m.Body, at: m.CreatedAt });
const detailJson = (d) => ({
  id: d.ConversationId, status: d.Status, needsHuman: Boolean(d.NeedsHuman), aiEnabled: Boolean(d.AiEnabled),
  customerName: d.CustomerName, customerPhone: d.CustomerPhone || null, customerEmail: d.CustomerEmail || null, isMember: Boolean(d.CustomerId),
  product: d.ProductId ? { id: d.ProductId, name: d.ProductName, slug: d.ProductSlug } : null,
  assignedName: d.AssignedName || null, assignedToMe: false,
});

async function load(req, res) {
  const id = parseId(req.params.id);
  const d = id ? await Chat.detailForStaff(id) : null;
  if (!d) { res.status(404).json({ ok: false, error: 'Hội thoại không tồn tại.' }); return null; }
  return d;
}

// GET /staff/chat
exports.index = (req, res) => res.render('staff/chat/index', {
  title: 'Chat khách hàng', selected: parseId(req.query.c) || '',
  employeeId: req.session.user.employeeId,
});

// GET /staff/chat/api/list?status=open|closed|all&q=
exports.list = async (req, res) => {
  const rows = await Chat.listForStaff(req.query);
  res.json({
    ok: true,
    conversations: rows.map((r) => ({
      id: r.ConversationId, status: r.Status, needsHuman: Boolean(r.NeedsHuman), aiEnabled: Boolean(r.AiEnabled), unread: r.Unread,
      name: r.CustomerName, isMember: Boolean(r.CustomerId), product: r.ProductName || null, assignedName: r.AssignedName || null,
      preview: r.Preview || '', at: r.LastMessageAt,
    })),
  });
};

// GET /staff/chat/api/unread - số hội thoại có tin chưa đọc (badge trên menu)
exports.unread = async (req, res) => res.json({ ok: true, count: await Chat.unreadConversationsForStaff() });

// GET /staff/chat/api/:id/messages?after=N - tin nhắn mới + đánh dấu nhân viên đã đọc
exports.messages = async (req, res) => {
  const d = await load(req, res);
  if (!d) return null;
  const after = parseInt(req.query.after, 10) || 0;
  const messages = await Chat.messagesAfter(d.ConversationId, after, 200);
  await Chat.markStaffRead(d.ConversationId);
  const conversation = detailJson(d);
  conversation.assignedToMe = Boolean(d.AssignedEmployeeId && d.AssignedEmployeeId === req.session.user.employeeId);
  return res.json({ ok: true, conversation, messages: messages.map(publicMessage) });
};

// POST /staff/chat/api/:id/send { body }
exports.send = async (req, res) => {
  const d = await load(req, res);
  if (!d) return null;
  const body = typeof req.body.body === 'string' ? req.body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!body) return res.status(400).json({ ok: false, error: 'Vui lòng nhập nội dung.' });
  if (body.length > Chat.MAX_BODY) return res.status(400).json({ ok: false, error: `Tối đa ${Chat.MAX_BODY} ký tự.` });
  const message = await Chat.addMessage(d.ConversationId, 'Staff', body, req.session.user.employeeId);
  await Chat.markStaffRead(d.ConversationId);
  return res.json({ ok: true, message: publicMessage(message) });
};

// POST /staff/chat/api/:id/claim - nhận hội thoại (tắt AI)
exports.claim = async (req, res) => {
  const d = await load(req, res);
  if (!d) return null;
  await Chat.claim(d.ConversationId, req.session.user.employeeId);
  await audit.log(req, 'CHAT_CLAIM', 'ChatConversation', d.ConversationId, 'Nhận hội thoại chat');
  return res.json({ ok: true });
};

// POST /staff/chat/api/:id/status { status: Open|Closed }
exports.status = async (req, res) => {
  const d = await load(req, res);
  if (!d) return null;
  const status = req.body.status === 'Closed' ? 'Closed' : 'Open';
  await Chat.setStatus(d.ConversationId, status);
  await audit.log(req, status === 'Closed' ? 'CHAT_CLOSE' : 'CHAT_REOPEN', 'ChatConversation', d.ConversationId, status === 'Closed' ? 'Đóng hội thoại chat' : 'Mở lại hội thoại chat');
  return res.json({ ok: true });
};

// POST /staff/chat/api/:id/ai { enabled: 0|1 }
exports.ai = async (req, res) => {
  const d = await load(req, res);
  if (!d) return null;
  await Chat.setAi(d.ConversationId, req.body.enabled === '1' || req.body.enabled === 1 || req.body.enabled === true);
  return res.json({ ok: true });
};
