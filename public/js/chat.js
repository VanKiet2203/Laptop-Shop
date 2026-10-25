/* Khung chat nổi phía khách. Nội dung tin nhắn luôn chèn bằng textContent (an toàn trước mã độc).
   Cập nhật bằng polling: mở khung = 3 giây/lần; thu nhỏ nhưng đã có hội thoại = 20 giây/lần (để hiện số tin chưa đọc); tab ẩn thì nghỉ. */
(function () {
  'use strict';
  var root = document.getElementById('chat-widget');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };
  var ui = { toggle: $('chatw-toggle'), panel: $('chatw-panel'), close: $('chatw-close'), unread: $('chatw-unread'), status: $('chatw-status'),
    list: $('chatw-messages'), hello: $('chatw-hello'), chips: $('chatw-chips'), form: $('chatw-form'), input: $('chatw-input'), send: $('chatw-send'),
    human: $('chatw-human'), guest: $('chatw-guest'), nameRow: $('chatw-name-row'), product: $('chatw-product'), productName: $('chatw-product-name'), productAsk: $('chatw-product-ask') };
  var HEADERS = { 'X-Requested-With': 'fetch', Accept: 'application/json' };
  var FLAG = 'lsChat';
  var st = { open: false, lastId: 0, hasConv: false, ids: {}, timer: null, needsHuman: false, busy: false };
  var isMember = root.getAttribute('data-user') === '1';
  var productEl = document.querySelector('[data-chat-product]');
  var product = productEl ? { id: Number(productEl.getAttribute('data-chat-product')), name: productEl.getAttribute('data-chat-name') || '' } : null;

  function flag(v) { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch (e) { /* bỏ qua */ } }
  function hasFlag() { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } }

  function api(path, data) {
    var opt = { credentials: 'same-origin', headers: Object.assign({}, HEADERS) };
    if (data) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/x-www-form-urlencoded'; opt.body = new URLSearchParams(data).toString(); }
    return fetch('/chat' + path, opt).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Lỗi máy chủ' }; }); });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtTime(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
  function linkify(container, text) {
    var re = /(\/(?:products|category|orders\/track|info)\/?[A-Za-z0-9\-_/?=&]*)/g; var last = 0; var m;
    while ((m = re.exec(text))) {
      if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, m[1]); a.href = m[1]; container.appendChild(a); last = m.index + m[1].length;
    }
    if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
  }

  function setUnread(n) { ui.unread.textContent = n > 9 ? '9+' : String(n); ui.unread.hidden = !n; }

  function addMessage(m) {
    if (st.ids[m.id]) return false; st.ids[m.id] = true;
    if (m.id > st.lastId) st.lastId = m.id;
    var mine = m.sender === 'Customer';
    var row = el('div', 'chatw-row ' + (mine ? 'is-mine' : 'is-agent'));
    var b = el('div', 'chatw-bubble ' + (mine ? 'is-mine' : m.sender === 'AI' ? 'is-ai' : 'is-agent'));
    if (!mine) b.appendChild(el('div', 'chatw-who', m.sender === 'AI' ? 'Trợ lý AI' : m.name + ' · nhân viên'));
    var body = el('div', 'chatw-text'); linkify(body, m.body); b.appendChild(body);
    b.appendChild(el('div', 'chatw-time', fmtTime(m.at)));
    row.appendChild(b); ui.list.appendChild(row);
    return true;
  }
  function removeHello() { if (ui.hello && ui.hello.parentNode) { ui.hello.parentNode.removeChild(ui.hello); ui.hello = null; } }
  function scrollDown() { ui.list.scrollTop = ui.list.scrollHeight; }
  function setStatus(d) {
    var base = 'Nhân viên phản hồi trong ít phút';
    if (d && d.conversation && d.conversation.needsHuman) base = 'Đã chuyển nhân viên · vui lòng chờ trong giây lát';
    else if (d && d.aiEnabled) base = 'Trợ lý AI hỗ trợ ngay khi nhân viên bận';
    ui.status.textContent = base;
    st.needsHuman = Boolean(d && d.conversation && d.conversation.needsHuman);
    ui.human.disabled = st.needsHuman;
    ui.human.title = st.needsHuman ? 'Đã yêu cầu nhân viên' : '';
  }

  function apply(d, opts) {
    if (!d || !d.ok) return;
    setStatus(d);
    if (!d.conversation) { st.hasConv = false; flag(false); setUnread(0); return; }
    st.hasConv = true; flag(true);
    ui.nameRow.hidden = true;
    var near = ui.list.scrollHeight - ui.list.scrollTop - ui.list.clientHeight < 90;
    var added = 0;
    d.messages.forEach(function (m) { removeHello(); if (addMessage(m)) added += 1; });
    if (st.open) { setUnread(0); if (added && (near || (opts && opts.scroll))) scrollDown(); } else setUnread(d.unread || 0);
  }

  function poll(opts) {
    if (st.busy) return Promise.resolve();
    return api('/state?after=' + st.lastId + (st.open ? '&open=1' : '')).then(function (d) { apply(d, opts); }).catch(function () {});
  }
  function schedule() {
    clearTimeout(st.timer);
    var delay = document.hidden ? 30000 : st.open ? 3000 : (st.hasConv ? 20000 : 0);
    if (!delay) return;
    st.timer = setTimeout(function () { poll().then(schedule); }, delay);
  }

  function openPanel() {
    st.open = true; ui.panel.hidden = false; ui.toggle.setAttribute('aria-expanded', 'true'); root.classList.add('is-open'); setUnread(0);
    if (product && product.id) { ui.product.hidden = false; ui.productName.textContent = product.name || 'Sản phẩm đang xem'; }
    poll({ scroll: true }).then(function () { scrollDown(); schedule(); });
    setTimeout(function () { ui.input.focus(); }, 50);
  }
  function closePanel() {
    st.open = false; ui.panel.hidden = true; ui.toggle.setAttribute('aria-expanded', 'false'); root.classList.remove('is-open'); schedule();
  }
  ui.toggle.addEventListener('click', function () { if (st.open) closePanel(); else openPanel(); });
  ui.close.addEventListener('click', function () { closePanel(); ui.toggle.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.open) { closePanel(); ui.toggle.focus(); } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (st.open || st.hasConv)) poll().then(schedule); else schedule(); });

  function send(text) {
    text = String(text || '').trim(); if (!text || st.busy) return;
    st.busy = true; ui.send.disabled = true;
    var data = { body: text };
    if (!isMember && ui.guest.value.trim()) data.guestName = ui.guest.value.trim();
    if (product && product.id) data.productId = String(product.id);
    api('/send', data).then(function (d) {
      if (d && d.ok) {
        removeHello(); addMessage(d.message); scrollDown(); ui.input.value = ''; autosize(); st.hasConv = true; flag(true); ui.nameRow.hidden = true; setStatus(d);
      } else {
        var err = el('div', 'chatw-error', (d && d.error) || 'Chưa gửi được tin nhắn, vui lòng thử lại.'); ui.list.appendChild(err); scrollDown();
        setTimeout(function () { if (err.parentNode) err.parentNode.removeChild(err); }, 6000);
      }
    }).catch(function () {}).then(function () { st.busy = false; ui.send.disabled = false; ui.input.focus(); schedule(); });
  }
  ui.form.addEventListener('submit', function (e) { e.preventDefault(); send(ui.input.value); });
  ui.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ui.input.value); } });
  function autosize() { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(110, ui.input.scrollHeight) + 'px'; }
  ui.input.addEventListener('input', autosize);
  ui.chips.addEventListener('click', function (e) { var b = e.target.closest('[data-text]'); if (b) send(b.getAttribute('data-text')); });
  ui.productAsk.addEventListener('click', function () { send('Mình muốn hỏi về sản phẩm: ' + (product.name || 'này') + '.'); });
  ui.human.addEventListener('click', function () {
    if (!st.hasConv) { ui.input.focus(); ui.input.placeholder = 'Hãy nhập câu hỏi để gửi nhân viên…'; return; }
    api('/human', {}).then(function (d) { if (d && d.ok) { if (d.message) { addMessage(d.message); scrollDown(); } ui.human.disabled = true; ui.status.textContent = 'Đã chuyển nhân viên · vui lòng chờ trong giây lát'; } });
  });

  // Tải sẵn nếu khách đã đăng nhập hoặc từng chat trên trình duyệt này (để hiện số tin chưa đọc, không tốn truy vấn cho khách chỉ xem hàng)
  if (isMember || hasFlag()) poll().then(schedule);
})();
