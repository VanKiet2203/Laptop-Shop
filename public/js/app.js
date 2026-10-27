// JS dùng chung (không dùng thư viện; tất cả hiệu ứng đều có phương án dự phòng khi JS lỗi/tắt).
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var fmtMoney = function (n) { return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' ₫'; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function icon(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="/icons/sprite.svg#i-' + name + '"></use></svg>';
  }
  function post(url, data, json) {
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'X-Requested-With': 'fetch', Accept: 'application/json' }, json ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: json ? JSON.stringify(data) : new URLSearchParams(data).toString(),
      credentials: 'same-origin',
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }); });
  }

  /* ---------- Toast ---------- */
  function toast(message, type, link) {
    var stack = $('#toast-stack');
    if (!stack) return;
    var el = document.createElement('div');
    el.className = 'toast-item' + (type === 'error' ? ' is-error' : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = icon(type === 'error' ? 'alert' : 'checkcircle') + '<span>' + esc(message) + '</span>' + (link ? '<a href="' + esc(link.href) + '">' + esc(link.text) + '</a>' : '');
    stack.appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); setTimeout(function () { el.remove(); }, 260); }, type === 'error' ? 4500 : 3200);
  }
  window.LS = { toast: toast };

  /* ---------- Badge giỏ hàng ---------- */
  function setCartCount(n) {
    var badge = $('#cart-count');
    if (!badge) return;
    badge.textContent = n;
    badge.classList.toggle('is-empty', !n);
    badge.classList.remove('is-updated');
    void badge.offsetWidth; // chạy lại animation
    badge.classList.add('is-updated');
    badge.addEventListener('animationend', function () { badge.classList.remove('is-updated'); }, { once: true });
  }

  /* ---------- Ảnh lỗi -> ảnh minh hoạ theo danh mục ---------- */
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var fb = img.getAttribute('data-fallback');
    if (fb && img.getAttribute('src') !== fb && !img.dataset.fellBack) { img.dataset.fellBack = '1'; img.src = fb; }
    if (img.hasAttribute('data-qr')) {
      img.hidden = true;
      var next = img.nextElementSibling;
      if (next) next.hidden = false;
    }
  }, true);

  /* ---------- Xác nhận trước khi gửi form (data-confirm) ---------- */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var msg = form.getAttribute && form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  /* ---------- Sao chép (mã giảm giá, số tài khoản...) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () {
      btn.classList.add('is-copied');
      toast('Đã sao chép: ' + text);
      setTimeout(function () { btn.classList.remove('is-copied'); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Sao chép:', text); });
    else window.prompt('Sao chép:', text);
  });

  /* ---------- Thêm vào giỏ (không tải lại trang) ---------- */
  function addToCart(productId, qty, button) {
    if (button) { button.classList.add('is-loading'); }
    return post('/cart/add', { productId: productId, qty: qty || 1 }).then(function (res) {
      if (button) button.classList.remove('is-loading');
      if (res.data && typeof res.data.count === 'number') setCartCount(res.data.count);
      if (res.ok && res.data.ok) {
        toast(res.data.message || 'Đã thêm vào giỏ hàng.', 'ok', { href: '/cart', text: 'Xem giỏ' });
        if (button) {
          button.classList.add('is-added');
          var old = button.innerHTML;
          if (button.classList.contains('pcard-add')) button.innerHTML = icon('check');
          else button.innerHTML = icon('check') + ' Đã thêm';
          setTimeout(function () { button.classList.remove('is-added'); button.innerHTML = old; }, 1600);
        }
      } else {
        toast((res.data && res.data.message) || 'Không thể thêm vào giỏ.', 'error');
      }
    }).catch(function () {
      if (button) button.classList.remove('is-loading');
      toast('Mất kết nối, vui lòng thử lại.', 'error');
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    e.preventDefault();
    addToCart(btn.getAttribute('data-add-to-cart'), 1, btn);
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('form[data-add-form]');
    if (!form) return;
    e.preventDefault();
    var btn = form.querySelector('.btn-buy');
    addToCart(form.elements.productId.value, form.elements.qty ? form.elements.qty.value : 1, btn);
  });
  // Giữ tương thích: form thêm giỏ kiểu cũ (không AJAX) vẫn nảy badge ở trang kế tiếp
  $$('form[action="/cart/add"]:not([data-add-form])').forEach(function (f) {
    f.addEventListener('submit', function () { try { sessionStorage.setItem('ls-cart-pulse', '1'); } catch (err) { /* bỏ qua */ } });
  });

  /* ---------- Ô số lượng có nút -/+ ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qty] .qty-btn');
    if (!b) return;
    var input = b.parentElement.querySelector('input');
    var min = Number(input.min) || 1;
    var max = Number(input.max) || 99;
    var v = (parseInt(input.value, 10) || min) + Number(b.getAttribute('data-step'));
    input.value = Math.min(max, Math.max(min, v));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ---------- Giỏ hàng: cập nhật số lượng/ xoá bằng AJAX ---------- */
  function refreshCartSummary(subtotal) {
    var root = $('#cart-root');
    if (!root) return;
    $$('[data-subtotal]').forEach(function (el) { el.textContent = fmtMoney(subtotal); });
    var free = Number(root.getAttribute('data-free-ship')) || 5000000;
    var text = $('[data-ship-text]');
    var bar = $('[data-ship-bar]');
    if (text) {
      text.innerHTML = subtotal >= free
        ? icon('truck', 'ico-sm') + ' Đơn của bạn được <strong>miễn phí giao hàng</strong>'
        : icon('truck', 'ico-sm') + ' Mua thêm <strong>' + fmtMoney(free - subtotal) + '</strong> để được miễn phí giao hàng';
    }
    if (bar) bar.style.width = Math.min(100, subtotal / free * 100) + '%';
    var qty = $$('[data-line] input[name="qty"]').reduce(function (s, i) { return s + (parseInt(i.value, 10) || 0); }, 0);
    $$('[data-cart-count]').forEach(function (el) { el.textContent = qty; });
  }
  function initCart() {
    var root = $('#cart-root');
    if (!root) return;
    var subtotal = 0;
    $$('[data-line]').forEach(function (l) { subtotal += Number(l.dataset.price) * (parseInt($('input[name="qty"]', l).value, 10) || 0); });
    refreshCartSummary(subtotal);
  }
  var cartTimers = {};
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!(input.matches && input.matches('[data-qty-form] input[name="qty"]'))) return;
    var line = input.closest('[data-line]');
    var id = line.dataset.productId;
    var max = Number(input.max) || 99;
    var qty = Math.min(max, Math.max(1, parseInt(input.value, 10) || 1));
    input.value = qty;
    // cập nhật tạm ngay trên giao diện cho cảm giác mượt, server xác nhận lại sau
    line.querySelector('[data-line-total]').textContent = fmtMoney(qty * Number(line.dataset.price));
    var sub = 0;
    $$('[data-line]').forEach(function (l) { sub += Number(l.dataset.price) * (parseInt($('input[name="qty"]', l).value, 10) || 0); });
    refreshCartSummary(sub);
    line.classList.add('is-busy');
    clearTimeout(cartTimers[id]);
    cartTimers[id] = setTimeout(function () {
      post('/cart/update', { productId: id, qty: qty }).then(function (res) {
        line.classList.remove('is-busy');
        if (!res.ok || !res.data.ok) { toast('Không cập nhật được số lượng.', 'error'); return; }
        var d = res.data;
        setCartCount(d.count);
        if (d.removed) { location.reload(); return; }
        input.value = d.qty;
        line.querySelector('[data-line-total]').textContent = fmtMoney(d.lineTotal);
        refreshCartSummary(d.subtotal);
        if (d.clamped && d.message) toast(d.message, 'error');
      }).catch(function () { line.classList.remove('is-busy'); toast('Mất kết nối, vui lòng thử lại.', 'error'); });
    }, 350);
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('form[data-remove-form]');
    if (!form) return;
    e.preventDefault();
    var line = form.closest('[data-line]');
    var id = line.dataset.productId;
    post('/cart/remove/' + id, {}).then(function (res) {
      if (!res.ok || !res.data.ok) { toast('Không xoá được sản phẩm.', 'error'); return; }
      setCartCount(res.data.count);
      line.classList.add('is-removing');
      setTimeout(function () {
        line.remove();
        if (res.data.empty) { location.reload(); return; }
        refreshCartSummary(res.data.subtotal);
        toast('Đã bỏ sản phẩm khỏi giỏ.');
      }, reduceMotion ? 0 : 240);
    }).catch(function () { toast('Mất kết nối, vui lòng thử lại.', 'error'); });
  });

  /* ---------- Gợi ý tìm kiếm khi đang gõ ---------- */
  function initSuggest() {
    var input = $('#nav-search-q');
    var box = $('#suggest-box');
    var list = $('#suggest-list');
    if (!input || !box || !list) return;
    var timer = null; var ctl = null; var items = []; var active = -1; var lastQ = '';

    function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function mark(text, q) {
      var out = esc(text);
      q.split(/\s+/).filter(Boolean).forEach(function (t) {
        var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    }
    function render(data, q) {
      var html = '';
      if (data.categories && data.categories.length) {
        html += '<li class="sg-head" role="presentation">Danh mục</li>';
        data.categories.forEach(function (c) {
          html += '<li role="presentation"><a class="sg-item" role="option" href="/category/' + encodeURIComponent(c.Slug) + '"><span class="sg-ico">' + icon('grid') + '</span><span class="sg-text"><span class="sg-name">' + mark(c.CategoryName, q) + '</span><span class="sg-sub">Xem tất cả sản phẩm</span></span></a></li>';
        });
      }
      if (data.brands && data.brands.length) {
        html += '<li class="sg-head" role="presentation">Thương hiệu</li>';
        data.brands.forEach(function (b) {
          html += '<li role="presentation"><a class="sg-item" role="option" href="/products?brandId=' + b.BrandId + '"><span class="sg-ico">' + icon('tag') + '</span><span class="sg-text"><span class="sg-name">' + mark(b.BrandName, q) + '</span><span class="sg-sub">Sản phẩm của hãng</span></span></a></li>';
        });
      }
      if (data.products && data.products.length) {
        html += '<li class="sg-head" role="presentation">Sản phẩm gợi ý</li>';
        data.products.forEach(function (p) {
          var img = p.PrimaryImage && p.PrimaryImage.indexOf('placeholder.svg') < 0 ? p.PrimaryImage : '/images/cat-laptop.svg';
          html += '<li role="presentation"><a class="sg-item" role="option" href="/products/' + encodeURIComponent(p.Slug) + '"><img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer" loading="lazy" data-fallback="/images/cat-laptop.svg"><span class="sg-text"><span class="sg-name">' + mark(p.ProductName, q) + '</span><span class="sg-sub">' + esc(p.BrandName) + (p.QtyAvailable > 0 ? '' : ' · Hết hàng') + '</span></span><span class="sg-price">' + fmtMoney(p.SalePrice) + '</span></a></li>';
        });
      }
      if (!html) html = '<li class="sg-empty" role="presentation">Không có gợi ý cho "' + esc(q) + '". Nhấn Enter để tìm kiếm.</li>';
      else html += '<li class="sg-foot" role="presentation"><span>Nhấn Enter để xem tất cả kết quả</span><a href="/products?q=' + encodeURIComponent(q) + '">Xem tất cả &rarr;</a></li>';
      list.innerHTML = html;
      items = $$('.sg-item', list);
      active = -1;
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function fetchSuggest(q) {
      if (ctl) ctl.abort();
      ctl = window.AbortController ? new AbortController() : null;
      fetch('/api/suggest?q=' + encodeURIComponent(q), { signal: ctl ? ctl.signal : undefined, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (input.value.trim() === q) render(d, q); })
        .catch(function () { /* bị huỷ do gõ tiếp, bỏ qua */ });
    }
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      if (q === lastQ && !box.hidden) return;
      lastQ = q;
      timer = setTimeout(function () { fetchSuggest(q); }, 170);
    });
    input.addEventListener('focus', function () { if (items.length && input.value.trim().length >= 2) box.hidden = false; });
    function setActive(i) {
      items.forEach(function (el) { el.classList.remove('is-active'); });
      active = i;
      if (i >= 0 && items[i]) { items[i].classList.add('is-active'); items[i].scrollIntoView({ block: 'nearest' }); }
    }
    input.addEventListener('keydown', function (e) {
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); items[active].click(); window.location.href = items[active].href; }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.store-search')) close(); });
  }

  /* ---------- Bộ lọc tức thì (không cần bấm "Lọc", giữ nguyên mọi điều kiện đã chọn) ---------- */
  function initCatalog() {
    var root = $('#catalog-root');
    if (!root) return;
    var busy = null;

    function load(url, push, scrollTop) {
      var catalog = $('#catalog', root);
      if (catalog) catalog.classList.add('is-loading');
      if (busy) busy.abort();
      busy = window.AbortController ? new AbortController() : null;
      fetch(url, { headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin', signal: busy ? busy.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
        .then(function (html) {
          root.innerHTML = html;
          if (push) history.pushState({ catalog: true }, '', url);
          document.title = ($('.catalog-title', root) ? $('.catalog-title', root).textContent + ' | ' : '') + 'Laptop Shop';
          var q = new URL(url, location.href).searchParams.get('q');
          var si = $('#nav-search-q'); if (si) si.value = q || '';
          if (scrollTop) root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        })
        .catch(function (err) { if (err && err.name === 'AbortError') return; window.location.href = url; });
    }
    function formUrl(form) {
      var params = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled) return;
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        if (el.value === '') return;
        params.append(el.name, el.value);
      });
      // ô sắp xếp nằm ngoài <form> nhưng gắn bằng form="filter-form"
      $$('[form="' + form.id + '"]').forEach(function (el) { if (el.name && el.value && !params.has(el.name)) params.append(el.name, el.value); });
      if (params.get('sort') === 'newest') params.delete('sort');
      var s = params.toString();
      return form.getAttribute('action') + (s ? '?' + s : '');
    }
    var timer;
    document.addEventListener('change', function (e) {
      var el = e.target;
      var form = el.form || (el.getAttribute && el.getAttribute('form') && document.getElementById(el.getAttribute('form')));
      if (!form || !form.hasAttribute('data-live-filter') || !root.contains(form)) return;
      clearTimeout(timer);
      timer = setTimeout(function () { load(formUrl(form), true, false); }, 60);
    });
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form.hasAttribute && form.hasAttribute('data-live-filter') && root.contains(form)) { e.preventDefault(); load(formUrl(form), true, false); }
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-ajax]');
      if (!a || !root.contains(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      load(a.getAttribute('href'), true, a.hasAttribute('data-scroll'));
    });
    window.addEventListener('popstate', function () { if (location.pathname.indexOf('/products') === 0 || location.pathname.indexOf('/category/') === 0) load(location.pathname + location.search, false, false); });
  }

  /* ---------- Trang chi tiết sản phẩm: đổi ảnh chính ---------- */
  function initGallery() {
    var main = $('#pd-main');
    var thumbs = $$('.pd-thumb');
    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (main) { main.dataset.fellBack = ''; main.src = btn.getAttribute('data-src'); }
        thumbs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  }

  /* ---------- Thanh toán ---------- */
  function initCheckout() {
    var form = $('#checkout-form');
    if (!form) return;
    var total = Number($('#summary-total').getAttribute('data-total')) || 0;
    var subtotal = 0;

    // chọn địa chỉ đã lưu / nhập địa chỉ mới
    var addrForm = $('[data-addr-form]');
    function syncAddr() {
      var picked = $('input[name="addressId"]:checked');
      var useNew = !picked || picked.value === 'new';
      if (addrForm) {
        addrForm.classList.toggle('is-hidden', !useNew);
        $$('input, select', addrForm).forEach(function (el) {
          if (['receiverName', 'receiverPhone', 'addressLine', 'province'].indexOf(el.name) >= 0) el.required = useNew;
        });
      }
      $$('.addr-choice').forEach(function (c) { c.classList.toggle('is-selected', c.contains(picked)); });
    }
    $$('[data-addr-radio]').forEach(function (r) { r.addEventListener('change', syncAddr); });
    syncAddr();

    // phương thức thanh toán + bảng trả góp
    function syncPay() {
      var picked = $('input[name="paymentMethod"]:checked');
      var code = picked ? picked.value : '';
      $$('.pay-choice').forEach(function (c) { c.classList.toggle('is-selected', c.contains(picked)); });
      $$('[data-pay-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-pay-panel') !== code; });
      calcInstall();
    }
    function calcInstall() {
      var provider = $('[data-inst-provider]');
      if (!provider) return;
      var months = $('[data-inst-months]');
      var prepay = $('[data-inst-prepay]');
      var isCard = provider.value === 'card';
      // thẻ tín dụng 0% chỉ áp dụng kỳ hạn 6-12 tháng
      Array.prototype.forEach.call(months.options, function (o) { o.disabled = isCard && Number(o.value) > 12; });
      if (months.options[months.selectedIndex].disabled) months.value = '12';
      var m = Number(months.value);
      var rate = isCard ? 0 : 1.2;
      var pre = Math.round(total * Number(prepay.value) / 100);
      var principal = total - pre;
      var interest = Math.round(principal * rate / 100 * m);
      var monthly = Math.round((principal + interest) / m);
      $('[data-inst-prepay-amount]').textContent = fmtMoney(pre);
      $('[data-inst-monthly]').textContent = fmtMoney(monthly);
      $('[data-inst-total]').textContent = fmtMoney(pre + principal + interest);
      $('[data-inst-hint]').textContent = isCard
        ? 'Thẻ tín dụng: lãi 0%, áp dụng kỳ hạn 6–12 tháng (phụ thuộc ngân hàng phát hành thẻ).'
        : 'Công ty tài chính: lãi ước tính ~1,2%/tháng trên dư nợ gốc (tham khảo), kỳ hạn 6–24 tháng.';
    }
    $$('[data-pay-radio]').forEach(function (r) { r.addEventListener('change', syncPay); });
    ['[data-inst-provider]', '[data-inst-months]', '[data-inst-prepay]'].forEach(function (s) { var el = $(s); if (el) el.addEventListener('change', calcInstall); });

    // mã khuyến mãi
    var btnPromo = $('#btn-apply-promo');
    var inputPromo = $('#promo-input');
    var msg = $('#promo-msg');
    function applyPromo() {
      var code = inputPromo.value.trim();
      if (!code) { msg.className = 'small mt-1 text-danger'; msg.textContent = 'Vui lòng nhập mã khuyến mãi.'; return; }
      btnPromo.disabled = true; btnPromo.textContent = 'Đang kiểm tra...';
      post('/checkout/promo', { promoCode: code }, true).then(function (res) {
        var d = res.data;
        if (d.success) {
          msg.className = 'small mt-1 text-success'; msg.textContent = 'Đã áp dụng mã ' + d.code + ' - giảm ' + fmtMoney(d.discountAmount) + '.';
          var row = $('#row-discount'); row.hidden = false;
          $('#summary-discount').textContent = '-' + fmtMoney(d.discountAmount);
          $('#summary-shipping').textContent = d.shippingFee === 0 ? 'Miễn phí' : fmtMoney(d.shippingFee);
          $('#summary-vat').textContent = fmtMoney(d.vatAmount);
          $('#summary-total').textContent = fmtMoney(d.totalAmount);
          total = d.totalAmount; calcInstall();
        } else {
          msg.className = 'small mt-1 text-danger'; msg.textContent = d.message || 'Mã khuyến mãi không hợp lệ.';
        }
      }).catch(function () { msg.className = 'small mt-1 text-danger'; msg.textContent = 'Không thể kiểm tra mã khuyến mãi.'; })
        .then(function () { btnPromo.disabled = false; btnPromo.textContent = 'Áp dụng'; });
    }
    if (btnPromo) btnPromo.addEventListener('click', applyPromo);
    $$('[data-use-code]').forEach(function (b) { b.addEventListener('click', function () { inputPromo.value = b.getAttribute('data-use-code'); applyPromo(); }); });
    if (inputPromo && inputPromo.value.trim()) applyPromo();

    // chống bấm đặt hàng nhiều lần + kiểm tra form
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
      var btn = $('#btn-place');
      if (btn.classList.contains('is-loading')) { e.preventDefault(); return; }
      btn.classList.add('is-loading');
    });
    syncPay();
    subtotal = 0;
  }

  /* ---------- Ảnh đại diện: thu nhỏ 256x256 rồi gửi lên ---------- */
  function initAvatar() {
    var input = $('[data-avatar-input]');
    if (!input) return;
    var status = $('#avatar-status');
    function say(text, cls) { status.textContent = text; status.className = 'profile-status ' + (cls || ''); }
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { say('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.', 'is-error'); return; }
      say('Đang xử lý ảnh...');
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext('2d');
        var s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        var quality = 0.88; var data = canvas.toDataURL('image/jpeg', quality);
        while (data.length > 130000 && quality > 0.4) { quality -= 0.1; data = canvas.toDataURL('image/jpeg', quality); }
        post('/account/avatar', { image: data }, true).then(function (res) {
          if (!res.ok || !res.data.ok) { say((res.data && res.data.message) || 'Không tải được ảnh.', 'is-error'); return; }
          var prev = $('#avatar-preview'); prev.src = res.data.url; prev.hidden = false;
          var letter = $('#avatar-letter'); if (letter) letter.hidden = true;
          say('Đã cập nhật ảnh đại diện.', 'is-ok');
          $$('.nav-user .avatar, .nav-user .avatar-img').forEach(function (el) {
            var n = document.createElement('img'); n.className = 'avatar-img'; n.src = res.data.url; n.alt = ''; el.replaceWith(n);
          });
        }).catch(function () { say('Mất kết nối, vui lòng thử lại.', 'is-error'); });
      };
      img.onerror = function () { say('Không đọc được ảnh này.', 'is-error'); };
      img.src = url;
    });
  }

  /* ---------- Dashboard: số KPI đếm từ 0 lên giá trị thật ---------- */
  function initCountUp() {
    if (reduceMotion) return;
    $$('[data-count]').forEach(function (el) {
      var target = Number(el.getAttribute('data-count'));
      if (!isFinite(target) || target <= 0) return;
      var start = null; var dur = 700;
      el.textContent = '0';
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick); else el.textContent = String(target);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Địa chỉ: chọn tỉnh/thành -> ô phường/xã tự đổ danh sách (lấy từ API địa giới qua /api/geo/wards) ---------- */
  function initGeo() {
    $$('select[data-geo-province]').forEach(function (prov) {
      var form = prov.form || document;
      var ward = form.querySelector('[data-geo-ward]');
      if (!ward) return;
      var seq = 0;
      function fill(list, selected) {
        var opts = '<option value="">Chọn phường/xã</option>';
        list.forEach(function (w) { opts += '<option value="' + esc(w) + '"' + (w === selected ? ' selected' : '') + '>' + esc(w) + '</option>'; });
        ward.innerHTML = opts;
        ward.disabled = false;
      }
      function toTextInput() {
        var input = document.createElement('input');
        input.type = 'text'; input.name = ward.name; input.id = ward.id; input.className = 'form-control'; input.maxLength = 100;
        input.placeholder = 'Nhập phường/xã'; input.value = ward.getAttribute('data-selected') || '';
        input.required = ward.required;
        ward.parentNode.replaceChild(input, ward);
        ward = input;
      }
      function load(selected) {
        var province = prov.value; var mine = ++seq;
        if (!province) { ward.innerHTML = '<option value="">Chọn tỉnh/thành phố trước</option>'; ward.disabled = true; return; }
        ward.disabled = true; ward.innerHTML = '<option value="">Đang tải phường/xã…</option>';
        fetch('/api/geo/wards?province=' + encodeURIComponent(province), { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (d) { if (mine !== seq) return; if (d.wards && d.wards.length) fill(d.wards, selected); else toTextInput(); })
          .catch(function () { if (mine === seq) toTextInput(); });
      }
      prov.addEventListener('change', function () { ward.setAttribute('data-selected', ''); load(''); });
      if (ward.tagName === 'SELECT' && ward.options.length <= 1) load(ward.getAttribute('data-selected') || '');
    });
  }

  // Hàng sản phẩm cuộn ngang: nút trái/phải (chỉ hiện khi tràn), kéo chuột để cuộn
  function initProductRows() {
    $$('[data-prow]').forEach(function (row) {
      var track = row.querySelector('[data-prow-track]');
      var prev = row.querySelector('[data-prow-prev]');
      var next = row.querySelector('[data-prow-next]');
      if (!track || !prev || !next) return;
      function sync() {
        var overflow = track.scrollWidth - track.clientWidth > 4;
        track.classList.toggle('is-scrollable', overflow);
        prev.hidden = next.hidden = !overflow;
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      }
      function step(dir) { track.scrollBy({ left: dir * Math.max(track.clientWidth * 0.85, 200), behavior: 'smooth' }); }
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      track.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync);
      var down = false, startX = 0, startLeft = 0, moved = false;
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
        down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
        if (moved) track.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-dragging'); });
      track.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { step(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
      });
      sync();
      // Ảnh tải xong có thể đổi kích thước -> tính lại
      window.addEventListener('load', sync);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initGeo(); initProductRows();
    var shouldPulse = false;
    try { shouldPulse = sessionStorage.getItem('ls-cart-pulse') === '1'; sessionStorage.removeItem('ls-cart-pulse'); } catch (e) { /* bỏ qua */ }
    if (shouldPulse) setCartCount(Number(($('#cart-count') || {}).textContent) || 0);
    initSuggest(); initCatalog(); initGallery(); initCart(); initCheckout(); initAvatar(); initCountUp();
  });
})();
