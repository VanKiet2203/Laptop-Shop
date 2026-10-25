/* Chat phía nhân viên: (1) badge số hội thoại chưa đọc trên menu, (2) hộp thư /staff/chat.
   Mọi nội dung do khách/AI/nhân viên gửi đều được chèn bằng textContent (không innerHTML) nên không thể chèn mã độc. */
(function () {
  'use strict';
  var API = '/staff/chat/api';
  var HEADERS = { 'X-Requested-With': 'fetch', Accept: 'application/json' };
  var baseTitle = document.title;

  function get(url) { return fetch(url, { credentials: 'same-origin', headers: HEADERS }).then(function (r) { return r.json(); }); }
  function post(url, data) {
    var body = new URLSearchParams(data || {});
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, HEADERS), body: body.toString() }).then(function (r) { return r.json(); });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var t = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + t;
  }
  /* Biến các đường dẫn /products/... thành liên kết (chỉ link nội bộ, tạo bằng DOM) */
  function linkify(container, text) {
    var re = /(\/(?:products|category|orders\/track|info)\/?[A-Za-z0-9\-_/?=&]*)/g; var last = 0; var m;
    while ((m = re.exec(text))) {
      if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, m[1]); a.href = m[1]; a.target = '_blank'; a.rel = 'noopener'; container.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
  }

  /* ---------- (1) Badge trên menu ---------- */
  var badge = document.getElementById('chat-badge');
  function setBadge(n) {
    if (!badge) return;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
    document.title = n ? '(' + n + ') ' + baseTitle : baseTitle;
  }
  function pollBadge() {
    if (document.hidden) return;
    get(API + '/unread').then(function (d) { if (d && d.ok) setBadge(d.count); }).catch(function () { /* mạng chập chờn: bỏ qua */ });
  }
  if (badge) { pollBadge(); setInterval(pollBadge, 15000); document.addEventListener('visibilitychange', pollBadge); }

  /* ---------- (2) Hộp thư ---------- */
  var app = document.getElementById('chat-app');
  if (!app) return;
  var listEl = document.getElementById('cs-conv-list');
  var listEmpty = document.getElementById('cs-list-empty');
  var searchEl = document.getElementById('cs-search');
  var pane = { empty: document.getElementById('cs-empty'), active: document.getElementById('cs-active'), name: document.getElementById('cs-name'), meta: document.getElementById('cs-meta'),
    messages: document.getElementById('cs-messages'), form: document.getElementById('cs-compose'), input: document.getElementById('cs-input'), send: document.getElementById('cs-send'),
    claim: document.getElementById('cs-claim'), ai: document.getElementById('cs-ai'), status: document.getElementById('cs-status'), quick: document.getElementById('cs-quick') };
  var state = { filter: 'open', current: null, lastId: 0, conv: null, timer: null, listTimer: null };

  var QUICK = [
    'Dạ chào anh/chị, em là nhân viên Laptop Shop. Em có thể hỗ trợ gì cho mình ạ?',
    'Dạ anh/chị đợi em kiểm tra tồn kho giúp mình ít phút nhé.',
    'Dạ anh/chị cho em xin số điện thoại để em tư vấn kỹ hơn nhé.',
    'Dạ sản phẩm bảo hành điện tử theo số Serial, anh/chị có thể tra cứu trên cửa hàng ạ.',
    'Dạ shop hỗ trợ trả góp 0% qua thẻ tín dụng, anh/chị có thể ước tính ngay ở bước thanh toán ạ.',
    'Cảm ơn anh/chị đã liên hệ Laptop Shop. Chúc anh/chị một ngày tốt lành!',
  ];
  QUICK.forEach(function (q, i) { var o = el('option', null, q.length > 70 ? q.slice(0, 68) + '…' : q); o.value = String(i); pane.quick.appendChild(o); });
  pane.quick.addEventListener('change', function () {
    if (pane.quick.value === '') return;
    pane.input.value = QUICK[Number(pane.quick.value)]; pane.quick.value = ''; pane.input.focus();
  });

  function renderList(items) {
    listEl.textContent = '';
    listEmpty.hidden = items.length > 0;
    items.forEach(function (c) {
      var li = el('li'); var b = el('button', 'cs-conv' + (state.current === c.id ? ' is-active' : '') + (c.unread ? ' is-unread' : '')); b.type = 'button';
      var top = el('div', 'cs-conv-top');
      top.appendChild(el('span', 'cs-conv-name', c.name));
      if (c.unread) top.appendChild(el('span', 'cs-unread', String(c.unread)));
      b.appendChild(top);
      var tags = el('div', 'cs-conv-tags');
      if (c.needsHuman) tags.appendChild(el('span', 'badge text-bg-danger', 'Cần nhân viên'));
      if (c.status === 'Closed') tags.appendChild(el('span', 'badge text-bg-secondary', 'Đã đóng'));
      if (!c.isMember) tags.appendChild(el('span', 'badge text-bg-light', 'Khách vãng lai'));
      if (c.assignedName) tags.appendChild(el('span', 'badge text-bg-info', c.assignedName));
      if (c.product) tags.appendChild(el('span', 'badge text-bg-light', c.product));
      if (tags.childNodes.length) b.appendChild(tags);
      b.appendChild(el('div', 'cs-conv-preview', c.preview));
      b.appendChild(el('div', 'cs-conv-time', fmtTime(c.at)));
      b.addEventListener('click', function () { open(c.id); });
      li.appendChild(b); listEl.appendChild(li);
    });
  }
  function loadList() {
    var q = searchEl.value.trim();
    return get(API + '/list?status=' + state.filter + (q ? '&q=' + encodeURIComponent(q) : '')).then(function (d) { if (d && d.ok) renderList(d.conversations); }).catch(function () {});
  }
  app.querySelectorAll('[data-status]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      app.querySelectorAll('[data-status]').forEach(function (x) { x.classList.toggle('active', x === btn); });
      state.filter = btn.getAttribute('data-status'); loadList();
    });
  });
  var searchTimer; searchEl.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(loadList, 300); });

  function addMessage(m) {
    var mine = m.sender === 'Staff'; var cust = m.sender === 'Customer';
    var row = el('div', 'cs-msg ' + (cust ? 'is-customer' : 'is-agent'));
    var bubble = el('div', 'cs-bubble ' + (m.sender === 'AI' ? 'is-ai' : mine ? 'is-staff' : 'is-cust'));
    var head = el('div', 'cs-msg-head'); head.appendChild(el('strong', null, m.sender === 'AI' ? 'Trợ lý AI' : m.name)); head.appendChild(el('span', null, ' · ' + fmtTime(m.at)));
    var body = el('div', 'cs-msg-body'); linkify(body, m.body);
    bubble.appendChild(head); bubble.appendChild(body); row.appendChild(bubble);
    pane.messages.appendChild(row);
    if (m.id > state.lastId) state.lastId = m.id;
  }
  function scrollDown() { pane.messages.scrollTop = pane.messages.scrollHeight; }
  function renderHead(c) {
    state.conv = c;
    pane.name.textContent = c.customerName;
    pane.meta.textContent = '';
    var parts = [c.isMember ? 'Khách có tài khoản' : 'Khách vãng lai'];
    if (c.customerPhone) parts.push('SĐT ' + c.customerPhone);
    if (c.customerEmail) parts.push(c.customerEmail);
    pane.meta.appendChild(el('span', null, parts.join(' · ')));
    if (c.product) { var a = el('a', 'ms-2', 'Đang hỏi: ' + c.product.name); a.href = '/products/' + encodeURIComponent(c.product.slug); a.target = '_blank'; a.rel = 'noopener'; pane.meta.appendChild(a); }
    if (c.needsHuman) pane.meta.appendChild(el('span', 'badge text-bg-danger ms-2', 'Khách cần nhân viên'));
    pane.claim.hidden = c.assignedToMe;
    pane.claim.textContent = c.assignedName && !c.assignedToMe ? 'Nhận từ ' + c.assignedName : 'Nhận hội thoại';
    pane.ai.textContent = c.aiEnabled ? 'Tắt AI cho hội thoại này' : 'Bật lại AI';
    pane.status.textContent = c.status === 'Closed' ? 'Mở lại' : 'Đóng hội thoại';
    pane.status.className = 'btn btn-sm ' + (c.status === 'Closed' ? 'btn-outline-success' : 'btn-outline-danger');
  }
  function poll() {
    if (!state.current || document.hidden) return Promise.resolve();
    var id = state.current;
    return get(API + '/' + id + '/messages?after=' + state.lastId).then(function (d) {
      if (!d || !d.ok || id !== state.current) return;
      renderHead(d.conversation);
      var near = pane.messages.scrollHeight - pane.messages.scrollTop - pane.messages.clientHeight < 80;
      d.messages.forEach(addMessage);
      if (d.messages.length && near) scrollDown();
    }).catch(function () {});
  }
  function open(id) {
    state.current = id; state.lastId = 0; pane.messages.textContent = '';
    pane.empty.hidden = true; pane.active.hidden = false;
    try { history.replaceState(null, '', '/staff/chat?c=' + id); } catch (e) { /* bỏ qua */ }
    poll().then(function () { scrollDown(); loadList(); pane.input.focus(); });
  }

  pane.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = pane.input.value.trim(); if (!text || !state.current) return;
    pane.send.disabled = true;
    post(API + '/' + state.current + '/send', { body: text }).then(function (d) {
      if (d && d.ok) { pane.input.value = ''; addMessage(d.message); scrollDown(); loadList(); poll(); } else { alert((d && d.error) || 'Không gửi được tin nhắn.'); }
    }).catch(function () { alert('Mất kết nối, chưa gửi được.'); }).then(function () { pane.send.disabled = false; pane.input.focus(); });
  });
  pane.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); pane.form.requestSubmit(); } });
  pane.claim.addEventListener('click', function () { post(API + '/' + state.current + '/claim').then(function () { poll(); loadList(); }); });
  pane.ai.addEventListener('click', function () { post(API + '/' + state.current + '/ai', { enabled: state.conv && state.conv.aiEnabled ? '0' : '1' }).then(function () { poll(); loadList(); }); });
  pane.status.addEventListener('click', function () {
    var closing = !(state.conv && state.conv.status === 'Closed');
    if (closing && !confirm('Đóng hội thoại này? Nếu khách nhắn tiếp, hội thoại sẽ tự mở lại.')) return;
    post(API + '/' + state.current + '/status', { status: closing ? 'Closed' : 'Open' }).then(function () { poll(); loadList(); });
  });

  loadList().then(function () { var sel = Number(app.getAttribute('data-selected')); if (sel) open(sel); });
  state.listTimer = setInterval(function () { if (!document.hidden) loadList(); }, 5000);
  state.timer = setInterval(poll, 3000);
})();
