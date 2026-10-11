// JS dùng chung (thêm hàm tiện ích của nhóm tại đây)

// Giỏ hàng là form POST tải lại trang thường (không AJAX) - đánh dấu lúc submit,
// rồi nảy badge #cart-count ở trang kế tiếp (CSS .is-updated đã định nghĩa trong app.css).
document.querySelectorAll('form[action="/cart/add"]').forEach(function (f) {
  f.addEventListener('submit', function () {
    try { sessionStorage.setItem('ls-cart-pulse', '1'); } catch (e) {}
  });
});

document.addEventListener('DOMContentLoaded', function () {
  var badge = document.getElementById('cart-count');
  var shouldPulse = false;
  try { shouldPulse = sessionStorage.getItem('ls-cart-pulse') === '1'; sessionStorage.removeItem('ls-cart-pulse'); } catch (e) {}
  if (badge && shouldPulse) {
    badge.classList.add('is-updated');
    badge.addEventListener('animationend', function () { badge.classList.remove('is-updated'); }, { once: true });
  }
});
