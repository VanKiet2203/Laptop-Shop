// Chat phía khách (khách vãng lai theo phiên, hoặc khách đã đăng nhập). API JSON cho khung chat nổi trên cửa hàng.
// Quy tắc: id hội thoại KHÔNG bao giờ nhận từ trình duyệt - luôn suy ra từ tài khoản/phiên, nên không đọc được hội thoại của người khác.
const Chat = require('../../models/chat.model');
const chatAi = require('../../core/chatAi');
const rateLimit = require('../../core/rateLimit');
const site = require('../../core/siteInfo');
const { parseId } = require('../../core/helpers');

const publicMessage = (m) => ({ id: m.MessageId, sender: m.SenderType, name: m.SenderName, body: m.Body, at: m.CreatedAt });
const cleanName = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) : '');

/** Chỉ khách hàng / khách vãng lai dùng khung chat này; tài khoản nhân viên dùng hộp thư trong /staff/chat. */
function isStaffAccount(req) {
  return Boolean(req.session.user && req.session.user.role !== 'CUSTOMER');
}

/** Hội thoại hiện tại của người đang truy cập (hoặc null nếu chưa có). */
async function currentConversation(req) {
  const user = req.session.user;
  if (user && user.role === 'CUSTOMER' && user.customerId) {
    let conv = await Chat.findForCustomer(user.customerId);
    // khách vừa đăng nhập giữa chừng: hội thoại vãng lai đang dở được gắn vào tài khoản (nếu tài khoản chưa có hội thoại)
    // hoặc gộp vào hội thoại sẵn có của tài khoản
    const guestId = req.session.chatConversationId;
    if (guestId && (!conv || conv.ConversationId !== guestId)) {
      if (!conv) await Chat.claimGuest(guestId, user.customerId);
      else await Chat.mergeGuest(guestId, conv.ConversationId);
      conv = await Chat.findForCustomer(user.customerId);
    }
    if (conv) req.session.chatConversationId = conv.ConversationId;
    return conv;
  }
  if (!req.session.chatConversationId) return null;
  const conv = await Chat.findById(req.session.chatConversationId);
  return conv && !conv.CustomerId ? conv : null;
}

const info = (conv) => (conv ? { id: conv.ConversationId, status: conv.Status, needsHuman: Boolean(conv.NeedsHuman) } : null);
const meta = () => ({ aiEnabled: chatAi.isConfigured(), hotline: site.hotline, hours: site.hotlineHours });

// GET /chat/state?after=N&open=1
exports.state = async (req, res) => {
  if (isStaffAccount(req)) return res.status(403).json({ ok: false, error: 'Tài khoản nhân viên dùng hộp thư chat trong khu quản lý.' });
  const conv = await currentConversation(req);
  if (!conv) return res.json({ ok: true, conversation: null, messages: [], unread: 0, ...meta() });
  const after = parseInt(req.query.after, 10) || 0;
  const messages = await Chat.messagesAfter(conv.ConversationId, after);
  if (req.query.open === '1' && messages.length) await Chat.markCustomerRead(conv.ConversationId);
  const unread = req.query.open === '1' ? 0 : await Chat.unreadForCustomer(conv.ConversationId);
  return res.json({ ok: true, conversation: info(conv), messages: messages.map(publicMessage), unread, ...meta() });
};

// POST /chat/send  { body, guestName?, productId? }
exports.send = async (req, res) => {
  if (isStaffAccount(req)) return res.status(403).json({ ok: false, error: 'Tài khoản nhân viên không dùng khung chat này.' });
  const body = typeof req.body.body === 'string' ? req.body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!body) return res.status(400).json({ ok: false, error: 'Vui lòng nhập nội dung tin nhắn.' });
  if (body.length > Chat.MAX_BODY) return res.status(400).json({ ok: false, error: `Tin nhắn tối đa ${Chat.MAX_BODY} ký tự.` });

  // chống spam: tối đa 1 tin / 1 giây / phiên và 30 tin / 10 phút / IP
  const now = Date.now();
  if (req.session.chatLastSend && now - req.session.chatLastSend < 1000) return res.status(429).json({ ok: false, error: 'Bạn gửi quá nhanh, vui lòng chậm lại một chút.' });
  if (!rateLimit.hit(`chat:ip:${req.ip}`, 30, 10 * 60 * 1000).allowed) return res.status(429).json({ ok: false, error: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút hoặc gọi hotline.' });
  req.session.chatLastSend = now;

  const user = req.session.user;
  let conv = await currentConversation(req);
  const productId = parseId(req.body.productId);
  if (!conv) {
    const guestName = user ? null : (cleanName(req.body.guestName) || 'Khách');
    const id = await Chat.create({ customerId: user ? user.customerId : null, guestName, productId: null });
    req.session.chatConversationId = id;
    conv = await Chat.findById(id);
  }
  if (productId) await Chat.setProduct(conv.ConversationId, productId);
  const message = await Chat.addMessage(conv.ConversationId, 'Customer', body);
  return res.json({ ok: true, message: publicMessage(message), conversation: { ...info(conv), status: 'Open' }, ...meta() });
};

// POST /chat/human - "Gặp nhân viên": AI dừng, hội thoại lên đầu hộp thư của nhân viên
exports.human = async (req, res) => {
  if (isStaffAccount(req)) return res.status(403).json({ ok: false });
  const conv = await currentConversation(req);
  if (!conv) return res.status(400).json({ ok: false, error: 'Hãy gửi một tin nhắn trước để nhân viên biết bạn cần hỗ trợ gì.' });
  if (!conv.NeedsHuman) {
    await Chat.requestHuman(conv.ConversationId);
    const m = await Chat.addMessage(conv.ConversationId, 'AI',
      `Mình đã chuyển cuộc trò chuyện cho nhân viên. Nhân viên sẽ trả lời bạn ngay khi rảnh${site.hotline ? `; nếu cần gấp, gọi hotline ${site.hotline}, ${site.hotlineHours}` : ''}.`);
    return res.json({ ok: true, message: publicMessage(m) });
  }
  return res.json({ ok: true });
};
