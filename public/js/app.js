// JS dùng chung (thêm hàm tiện ích của nhóm tại đây)

// Giỏ hàng là form POST tải lại trang thường (không AJAX) - đánh dấu lúc submit,
// rồi nảy badge #cart-count ở trang kế tiếp (CSS .is-updated đã định nghĩa trong app.css).
document.querySelectorAll('form[action="/cart/add"]').forEach(function (f) {
  f.addEventListener('submit', function () {
    try { sessionStorage.setItem('ls-cart-pulse', '1'); } catch (e) {}
  });
});

document.addEventListener('DOMContentLoaded', function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var badge = document.getElementById('cart-count');
  var shouldPulse = false;
  try { shouldPulse = sessionStorage.getItem('ls-cart-pulse') === '1'; sessionStorage.removeItem('ls-cart-pulse'); } catch (e) {}
  if (badge && shouldPulse) {
    badge.classList.add('is-updated');
    badge.addEventListener('animationend', function () { badge.classList.remove('is-updated'); }, { once: true });
  }

  // Dashboard: số KPI đếm từ 0 lên giá trị thật (~700ms). Nội dung thật đã có sẵn trong HTML nên
  // nếu JS lỗi / tắt hiệu ứng thì vẫn hiện đúng số.
  if (!reduceMotion) {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = Number(el.getAttribute('data-count'));
      if (!isFinite(target) || target <= 0) return;
      var start = null;
      var dur = 700;
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

  // Trang chi tiết sản phẩm: bấm ảnh nhỏ để đổi ảnh chính.
  var main = document.getElementById('pd-main');
  var thumbs = document.querySelectorAll('.pd-thumb');
  thumbs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (main) main.src = btn.getAttribute('data-src');
      thumbs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
    });
  });

  // Ô số lượng có nút -/+ (giữ trong khoảng min..max của input).
  document.querySelectorAll('[data-qty]').forEach(function (box) {
    var input = box.querySelector('input');
    box.querySelectorAll('.qty-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var min = Number(input.min) || 1;
        var max = Number(input.max) || 99;
        var v = (parseInt(input.value, 10) || min) + Number(b.getAttribute('data-step'));
        input.value = Math.min(max, Math.max(min, v));
      });
    });
  });
});
