// Chat khách hàng <-> nhân viên (+ trợ lý AI trả lời khi nhân viên chưa phản hồi). Model = nơi DUY NHẤT chứa SQL của nhóm này.
// Bảng liên quan: ChatConversations, ChatMessages (xem database/01_schema.sql)
const db = require('../config/db');

const MAX_BODY = 1000;
exports.MAX_BODY = MAX_BODY;

const MSG_COLUMNS = `m.MessageId, m.ConversationId, m.SenderType, m.Body, m.CreatedAt,
  CASE m.SenderType WHEN 'Staff' THEN e.FullName WHEN 'Customer' THEN COALESCE(c.FullName, cv.GuestName, N'Khách') ELSE N'Trợ lý AI' END AS SenderName`;
const MSG_FROM = `FROM dbo.ChatMessages m
  JOIN dbo.ChatConversations cv ON cv.ConversationId = m.ConversationId
  LEFT JOIN dbo.Customers c ON c.CustomerId = cv.CustomerId
  LEFT JOIN dbo.Employees e ON e.EmployeeId = m.EmployeeId`;

const toInt = (v) => (/^\d{1,9}$/.test(String(v)) ? Number(v) : 0);

/* ---------- Hội thoại ---------- */
exports.findById = (id) => db.queryOne('SELECT * FROM dbo.ChatConversations WHERE ConversationId = @id', { id });

/** Hội thoại gần nhất của một khách hàng (kể cả đã đóng - khách nhắn tiếp thì mở lại). */
exports.findForCustomer = (customerId) => db.queryOne(
  'SELECT TOP 1 * FROM dbo.ChatConversations WHERE CustomerId = @customerId ORDER BY ConversationId DESC', { customerId });

exports.create = async ({ customerId = null, guestName = null, productId = null }) => {
  const rows = await db.query(
    `INSERT INTO dbo.ChatConversations (CustomerId, GuestName, ProductId) VALUES (@customerId, @guestName, @productId);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS ConversationId`,
    { customerId, guestName, productId });
  return rows[0].ConversationId;
};

/** Khách vãng lai vừa đăng nhập: gắn hội thoại đang dở vào tài khoản (chỉ khi hội thoại chưa thuộc ai). */
exports.claimGuest = (conversationId, customerId) => db.query(
  'UPDATE dbo.ChatConversations SET CustomerId = @customerId WHERE ConversationId = @conversationId AND CustomerId IS NULL',
  { conversationId, customerId });

/**
 * Khách vừa đăng nhập mà tài khoản đã có hội thoại cũ: chuyển toàn bộ tin của hội thoại vãng lai sang hội thoại đó
 * (tin nhắn có mã tăng dần theo thời gian nên thứ tự vẫn đúng), mở lại hội thoại và xoá hội thoại vãng lai.
 */
exports.mergeGuest = (guestId, targetId) => db.transaction(async (tx) => {
  const g = await tx.query('SELECT NeedsHuman FROM dbo.ChatConversations WITH (UPDLOCK) WHERE ConversationId = @guestId AND CustomerId IS NULL', { guestId });
  if (!g[0] || guestId === targetId) return false;
  await tx.query('UPDATE dbo.ChatMessages SET ConversationId = @targetId WHERE ConversationId = @guestId', { guestId, targetId });
  await tx.query(
    `UPDATE dbo.ChatConversations SET Status = 'Open', LastMessageAt = SYSDATETIME(), NeedsHuman = CASE WHEN @needs = 1 THEN 1 ELSE NeedsHuman END
     WHERE ConversationId = @targetId`, { targetId, needs: g[0].NeedsHuman ? 1 : 0 });
  await tx.query('DELETE FROM dbo.ChatConversations WHERE ConversationId = @guestId', { guestId });
  return true;
});
exports.setProduct = (conversationId, productId) => db.query(
  `UPDATE dbo.ChatConversations SET ProductId = @productId
   WHERE ConversationId = @conversationId AND EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @productId AND IsActive = 1)`,
  { conversationId, productId });

/**
 * Thêm tin nhắn. Tin của khách tự mở lại hội thoại đã đóng; tin của nhân viên gán hội thoại cho nhân viên đó (nếu chưa ai nhận)
 * và gỡ cờ "cần nhân viên". Trả về tin vừa tạo (đủ cột để gửi cho trình duyệt).
 */
exports.addMessage = (conversationId, senderType, body, employeeId = null) => db.transaction(async (tx) => {
  const text = String(body).trim().slice(0, MAX_BODY);
  const ins = await tx.query(
    `INSERT INTO dbo.ChatMessages (ConversationId, SenderType, EmployeeId, Body) VALUES (@conversationId, @senderType, @employeeId, @body);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS MessageId`,
    { conversationId, senderType, employeeId, body: text });
  const messageId = ins[0].MessageId;
  await tx.query(
    `UPDATE dbo.ChatConversations SET LastMessageAt = SYSDATETIME(),
        Status = CASE WHEN @senderType = 'Customer' THEN 'Open' ELSE Status END,
        AssignedEmployeeId = CASE WHEN @senderType = 'Staff' AND AssignedEmployeeId IS NULL THEN @employeeId ELSE AssignedEmployeeId END,
        NeedsHuman = CASE WHEN @senderType = 'Staff' THEN 0 ELSE NeedsHuman END
     WHERE ConversationId = @conversationId`,
    { conversationId, senderType, employeeId });
  const rows = await tx.query(`SELECT ${MSG_COLUMNS} ${MSG_FROM} WHERE m.MessageId = @messageId`, { messageId });
  return rows[0];
});

exports.messagesAfter = (conversationId, afterId = 0, limit = 100) => db.query(
  `SELECT TOP (@limit) ${MSG_COLUMNS} ${MSG_FROM} WHERE m.ConversationId = @conversationId AND m.MessageId > @afterId ORDER BY m.MessageId`,
  { conversationId, afterId: toInt(afterId), limit });

/** N tin gần nhất (cũ -> mới), dùng làm ngữ cảnh cho AI. */
exports.lastMessages = async (conversationId, n = 12) => (await db.query(
  `SELECT TOP (@n) ${MSG_COLUMNS} ${MSG_FROM} WHERE m.ConversationId = @conversationId ORDER BY m.MessageId DESC`, { conversationId, n })).reverse();

exports.maxMessageId = async (conversationId) => (await db.queryOne(
  'SELECT ISNULL(MAX(MessageId), 0) AS id FROM dbo.ChatMessages WHERE ConversationId = @conversationId', { conversationId })).id;

/* ---------- Đã đọc / chưa đọc ---------- */
/** Số tin từ nhân viên/AI mà khách chưa đọc */
exports.unreadForCustomer = async (conversationId) => (await db.queryOne(
  `SELECT COUNT(*) AS n FROM dbo.ChatMessages m JOIN dbo.ChatConversations cv ON cv.ConversationId = m.ConversationId
   WHERE m.ConversationId = @conversationId AND m.SenderType <> 'Customer' AND m.MessageId > cv.CustomerReadUpTo`, { conversationId })).n;

exports.markCustomerRead = (conversationId) => db.query(
  `UPDATE dbo.ChatConversations SET CustomerReadUpTo = ISNULL((SELECT MAX(MessageId) FROM dbo.ChatMessages WHERE ConversationId = @conversationId), 0)
   WHERE ConversationId = @conversationId`, { conversationId });

exports.markStaffRead = (conversationId) => db.query(
  `UPDATE dbo.ChatConversations SET StaffReadUpTo = ISNULL((SELECT MAX(MessageId) FROM dbo.ChatMessages WHERE ConversationId = @conversationId), 0)
   WHERE ConversationId = @conversationId`, { conversationId });

/** Số hội thoại đang mở có tin khách mà nhân viên chưa đọc (hiện trên menu nhân viên). */
exports.unreadConversationsForStaff = async () => (await db.queryOne(
  `SELECT COUNT(*) AS n FROM dbo.ChatConversations cv
   WHERE cv.Status = 'Open' AND EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.ConversationId = cv.ConversationId AND m.SenderType = 'Customer' AND m.MessageId > cv.StaffReadUpTo)`)).n;

/* ---------- Nhân viên ---------- */
exports.normalizeListFilters = (q = {}) => ({
  status: ['open', 'closed', 'all'].includes(q.status) ? q.status : 'open',
  q: typeof q.q === 'string' ? q.q.trim().slice(0, 60) : '',
});

exports.listForStaff = (filters) => {
  const f = exports.normalizeListFilters(filters);
  return db.query(
    `SELECT TOP 100 cv.ConversationId, cv.Status, cv.NeedsHuman, cv.AiEnabled, cv.LastMessageAt, cv.CreatedAt, cv.CustomerId, cv.ProductId,
            COALESCE(c.FullName, cv.GuestName, N'Khách') AS CustomerName, c.Phone AS CustomerPhone, p.ProductName, ae.FullName AS AssignedName,
            (SELECT COUNT(*) FROM dbo.ChatMessages m WHERE m.ConversationId = cv.ConversationId AND m.SenderType = 'Customer' AND m.MessageId > cv.StaffReadUpTo) AS Unread,
            (SELECT TOP 1 CONCAT(CASE m.SenderType WHEN 'Customer' THEN N'' WHEN 'Staff' THEN N'Bạn: ' ELSE N'AI: ' END, LEFT(m.Body, 90))
               FROM dbo.ChatMessages m WHERE m.ConversationId = cv.ConversationId ORDER BY m.MessageId DESC) AS Preview
     FROM dbo.ChatConversations cv
     LEFT JOIN dbo.Customers c ON c.CustomerId = cv.CustomerId
     LEFT JOIN dbo.Products p ON p.ProductId = cv.ProductId
     LEFT JOIN dbo.Employees ae ON ae.EmployeeId = cv.AssignedEmployeeId
     WHERE (@status = 'all' OR (@status = 'open' AND cv.Status = 'Open') OR (@status = 'closed' AND cv.Status = 'Closed'))
       AND (@q = '' OR c.FullName LIKE '%' + @q + '%' OR cv.GuestName LIKE '%' + @q + '%' OR c.Phone LIKE '%' + @q + '%'
            OR EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.ConversationId = cv.ConversationId AND m.Body LIKE '%' + @q + '%'))
     ORDER BY CASE WHEN cv.Status = 'Open' AND cv.NeedsHuman = 1 THEN 0 ELSE 1 END,
              CASE WHEN EXISTS (SELECT 1 FROM dbo.ChatMessages m WHERE m.ConversationId = cv.ConversationId AND m.SenderType = 'Customer' AND m.MessageId > cv.StaffReadUpTo) THEN 0 ELSE 1 END,
              cv.LastMessageAt DESC`, f);
};

exports.detailForStaff = (conversationId) => db.queryOne(
  `SELECT cv.ConversationId, cv.Status, cv.NeedsHuman, cv.AiEnabled, cv.CreatedAt, cv.CustomerId, cv.ProductId, cv.AssignedEmployeeId,
          COALESCE(c.FullName, cv.GuestName, N'Khách') AS CustomerName, c.Phone AS CustomerPhone, c.Email AS CustomerEmail,
          p.ProductName, p.Slug AS ProductSlug, ae.FullName AS AssignedName
   FROM dbo.ChatConversations cv
   LEFT JOIN dbo.Customers c ON c.CustomerId = cv.CustomerId
   LEFT JOIN dbo.Products p ON p.ProductId = cv.ProductId
   LEFT JOIN dbo.Employees ae ON ae.EmployeeId = cv.AssignedEmployeeId
   WHERE cv.ConversationId = @conversationId`, { conversationId });

/** Nhận hội thoại: gán cho nhân viên, tắt AI và gỡ cờ "cần nhân viên". */
exports.claim = (conversationId, employeeId) => db.query(
  'UPDATE dbo.ChatConversations SET AssignedEmployeeId = @employeeId, AiEnabled = 0, NeedsHuman = 0 WHERE ConversationId = @conversationId',
  { conversationId, employeeId });

exports.setStatus = (conversationId, status) => db.query(
  `UPDATE dbo.ChatConversations SET Status = @status, NeedsHuman = CASE WHEN @status = 'Closed' THEN 0 ELSE NeedsHuman END WHERE ConversationId = @conversationId`,
  { conversationId, status });

exports.setAi = (conversationId, enabled) => db.query(
  'UPDATE dbo.ChatConversations SET AiEnabled = @enabled WHERE ConversationId = @conversationId', { conversationId, enabled: enabled ? 1 : 0 });

exports.requestHuman = (conversationId) => db.query(
  `UPDATE dbo.ChatConversations SET NeedsHuman = 1, Status = 'Open' WHERE ConversationId = @conversationId`, { conversationId });

/* ---------- Trợ lý AI ---------- */
/**
 * Hội thoại cần AI trả lời: đang mở, bật AI, khách chưa bấm "Gặp nhân viên", tin cuối là của KHÁCH và đã quá `delaySec` giây
 * chưa ai trả lời, nhân viên không hoạt động trong `staffActiveMin` phút gần đây, chưa vượt trần số lần AI trả lời.
 */
exports.aiCandidates = ({ delaySec, staffActiveMin, maxReplies, limit = 5 }) => db.query(
  `SELECT TOP (@limit) cv.ConversationId, last.MessageId AS LastMessageId
   FROM dbo.ChatConversations cv
   CROSS APPLY (SELECT TOP 1 MessageId, SenderType, CreatedAt FROM dbo.ChatMessages WHERE ConversationId = cv.ConversationId ORDER BY MessageId DESC) last
   WHERE cv.Status = 'Open' AND cv.AiEnabled = 1 AND cv.NeedsHuman = 0 AND cv.AiReplyCount < @maxReplies
     AND last.SenderType = 'Customer' AND last.CreatedAt <= DATEADD(SECOND, -@delaySec, SYSDATETIME())
     AND (cv.AiLockAt IS NULL OR cv.AiLockAt < DATEADD(SECOND, -60, SYSDATETIME()))
     AND NOT EXISTS (SELECT 1 FROM dbo.ChatMessages s WHERE s.ConversationId = cv.ConversationId AND s.SenderType = 'Staff'
                     AND s.CreatedAt >= DATEADD(MINUTE, -@staffActiveMin, SYSDATETIME()))
   ORDER BY last.CreatedAt`,
  { delaySec, staffActiveMin, maxReplies, limit });

/** Giành quyền soạn câu trả lời (chống 2 tiến trình/2 lượt quét cùng trả lời). Chỉ thành công nếu tin cuối vẫn là tin đã thấy. */
exports.lockForAi = async (conversationId, lastMessageId) => (await db.queryOne(
  `UPDATE dbo.ChatConversations SET AiLockAt = SYSDATETIME()
   WHERE ConversationId = @conversationId AND (AiLockAt IS NULL OR AiLockAt < DATEADD(SECOND, -60, SYSDATETIME()))
     AND (SELECT MAX(MessageId) FROM dbo.ChatMessages WHERE ConversationId = @conversationId) = @lastMessageId;
   SELECT @@ROWCOUNT AS n`, { conversationId, lastMessageId })).n > 0;

/** Lưu câu trả lời của AI nếu trong lúc soạn chưa có tin mới (của khách/nhân viên); luôn nhả khoá. Trả về tin đã lưu hoặc null. */
exports.finishAiReply = (conversationId, lastMessageId, body) => db.transaction(async (tx) => {
  const cur = await tx.query('SELECT ISNULL(MAX(MessageId), 0) AS id FROM dbo.ChatMessages WITH (UPDLOCK) WHERE ConversationId = @conversationId', { conversationId });
  if (!body || cur[0].id !== lastMessageId) {
    await tx.query('UPDATE dbo.ChatConversations SET AiLockAt = NULL WHERE ConversationId = @conversationId', { conversationId });
    return null;
  }
  const ins = await tx.query(
    `INSERT INTO dbo.ChatMessages (ConversationId, SenderType, Body) VALUES (@conversationId, 'AI', @body);
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS MessageId`, { conversationId, body: String(body).trim().slice(0, MAX_BODY) });
  await tx.query(
    `UPDATE dbo.ChatConversations SET AiLockAt = NULL, AiReplyCount = AiReplyCount + 1, LastMessageAt = SYSDATETIME() WHERE ConversationId = @conversationId`, { conversationId });
  const rows = await tx.query(`SELECT ${MSG_COLUMNS} ${MSG_FROM} WHERE m.MessageId = @messageId`, { messageId: ins[0].MessageId });
  return rows[0];
});

/** Danh mục sản phẩm đang bán (rút gọn) để AI tư vấn đúng sản phẩm/giá/tồn của shop. Cache 5 phút. */
let digestCache = { at: 0, rows: [] };
exports.catalogDigest = async () => {
  if (Date.now() - digestCache.at < 5 * 60 * 1000) return digestCache.rows;
  const rows = await db.query(
    `SELECT Slug, ProductName, CategoryName, BrandName, SalePrice, QtyAvailable, LEFT(ISNULL(ShortDesc, N''), 110) AS ShortDesc
     FROM dbo.vw_ProductCatalog WHERE IsActive = 1 ORDER BY CategoryName, SalePrice`);
  digestCache = { at: Date.now(), rows };
  return rows;
};

exports.activePromotions = () => db.query(
  `SELECT TOP 5 Code, PromoName, DiscountType, DiscountValue, MinOrderAmount, MaxDiscount, EndDate FROM dbo.Promotions
   WHERE IsActive = 1 AND StartDate <= SYSDATETIME() AND EndDate >= SYSDATETIME() AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
   ORDER BY EndDate`);
