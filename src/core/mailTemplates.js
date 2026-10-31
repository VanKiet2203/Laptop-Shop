// Nội dung email (HTML + văn bản thuần). MỌI giá trị từ khách/DB đều được escape trước khi chèn vào HTML.
const site = require('./siteInfo');
const { fmtMoney, fmtDateTime, ORDER_STATUS, PAYMENT_METHOD, installmentPlan } = require('./helpers');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f6fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,.08)">
<tr><td style="background:#4f46e5;padding:20px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.02em">${esc(site.name)}</td></tr>
<tr><td style="padding:28px">${bodyHtml}</td></tr>
<tr><td style="background:#0f172a;color:#94a3b8;padding:18px 28px;font-size:12px;line-height:1.6">
${esc(site.legalName)} · MST ${esc(site.taxCode)}<br>${esc(site.headOffice)}<br>Hotline ${esc(site.hotline)} (${esc(site.hotlineHours)}) · ${esc(site.email)}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${esc(label)}</a>`;

function paymentBlock(order, baseUrl) {
  const total = Number(order.TotalAmount);
  if (order.Status === 'Cancelled') return '';
  if (order.PaymentMethod === 'COD') {
    return { html: `<p style="margin:0 0 6px"><strong>Thanh toán khi nhận hàng (COD).</strong> Nhân viên sẽ gọi xác nhận qua số <strong>${esc(order.ReceiverPhone)}</strong> trước khi giao. Bạn kiểm tra hàng rồi thanh toán <strong>${esc(fmtMoney(total))}</strong> bằng tiền mặt.</p>`,
      text: `Thanh toán khi nhận hàng (COD): nhân viên sẽ gọi xác nhận qua số ${order.ReceiverPhone}; bạn thanh toán ${fmtMoney(total)} khi nhận hàng.` };
  }
  if (order.PaymentMethod === 'BankTransfer') {
    const b = site.bank;
    const qr = `https://img.vietqr.io/image/${encodeURIComponent(b.code)}-${encodeURIComponent(b.account)}-compact2.png?amount=${Math.round(total)}&addInfo=${encodeURIComponent(order.OrderNo)}&accountName=${encodeURIComponent(b.holder)}`;
    return { html: `<p style="margin:0 0 8px"><strong>Chuyển khoản ngân hàng</strong> — quét mã VietQR hoặc chuyển theo thông tin:</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:16px"><img src="${esc(qr)}" width="160" height="160" alt="Mã QR chuyển khoản" style="border:1px solid #e2e8f0;border-radius:8px"></td>
<td style="font-size:14px;line-height:1.8">Ngân hàng: <strong>${esc(b.name)}</strong><br>Số tài khoản: <strong>${esc(b.account)}</strong><br>Chủ tài khoản: <strong>${esc(b.holder)}</strong><br>Số tiền: <strong>${esc(fmtMoney(total))}</strong><br>Nội dung: <strong>${esc(order.OrderNo)}</strong></td></tr></table>`,
      text: `Chuyển khoản: ${b.name} - STK ${b.account} - ${b.holder}. Số tiền ${fmtMoney(total)}. Nội dung: ${order.OrderNo}.` };
  }
  if (order.PaymentMethod === 'Installment') {
    const plan = /^\[TRẢ GÓP\] (\d+) tháng · trả trước (\d+)% · ([^|]+)/.exec(order.Note || '');
    let detail = 'Nhân viên sẽ gọi để hướng dẫn hồ sơ trả góp.';
    if (plan) {
      const p = installmentPlan(total, Number(plan[1]), Number(plan[2]), /thẻ/.test(plan[3]) ? 0 : 1.2);
      detail = `Bạn chọn trả góp ${plan[1]} tháng, trả trước ${plan[2]}% (${fmtMoney(p.prepay)}), ước tính khoảng <strong>${esc(fmtMoney(p.monthly))}/tháng</strong> (${esc(plan[3].trim())}; số liệu tham khảo).`;
    }
    return { html: `<p style="margin:0 0 6px"><strong>Trả góp.</strong> ${detail} Nhân viên sẽ gọi để xác nhận hồ sơ.</p>`, text: 'Trả góp: nhân viên sẽ gọi để xác nhận hồ sơ trả góp.' };
  }
  return { html: `<p style="margin:0">Nhân viên sẽ gửi link thanh toán thẻ an toàn tới số <strong>${esc(order.ReceiverPhone)}</strong>.</p>`, text: `Thanh toán thẻ: nhân viên sẽ gửi link thanh toán tới số ${order.ReceiverPhone}.` };
}

/** Email xác nhận đơn hàng: chứa MÃ ĐƠN + link tra cứu để khách (kể cả không đăng nhập) tìm lại đơn. */
function orderConfirmation(order, baseUrl) {
  const status = ORDER_STATUS[order.Status] || { label: order.Status };
  const trackUrl = `${baseUrl}/orders/track?orderNo=${encodeURIComponent(order.OrderNo)}&phone=${encodeURIComponent(order.ReceiverPhone)}`;
  const pay = paymentBlock(order, baseUrl) || { html: '', text: '' };
  const rows = (order.items || []).map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f6;font-size:14px">${esc(i.ProductName)}<br><span style="color:#64748b;font-size:12px">SL ${esc(i.Quantity)} × ${esc(fmtMoney(i.UnitPrice))}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f6;font-size:14px;white-space:nowrap"><strong>${esc(fmtMoney(i.LineTotal))}</strong></td></tr>`).join('');
  const html = layout(`Xác nhận đơn hàng ${order.OrderNo}`, `
<h1 style="margin:0 0 6px;font-size:22px">Cảm ơn bạn đã đặt hàng!</h1>
<p style="margin:0 0 18px;color:#475569">Xin chào <strong>${esc(order.ReceiverName)}</strong>, ${site.name} đã nhận đơn của bạn.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:12px;margin-bottom:18px"><tr><td style="padding:16px 20px">
<div style="font-size:12px;color:#4338ca;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Mã đơn hàng của bạn</div>
<div style="font-size:26px;font-weight:800;letter-spacing:.04em;font-family:Consolas,monospace;color:#1e1b4b">${esc(order.OrderNo)}</div>
<div style="font-size:13px;color:#475569;margin-top:4px">Đặt lúc ${esc(fmtDateTime(order.CreatedAt))} · Trạng thái: <strong>${esc(status.label)}</strong></div></td></tr></table>
<p style="margin:0 0 18px">${button(trackUrl, 'Xem / tra cứu đơn hàng')}</p>
<p style="margin:0 0 16px;font-size:13px;color:#64748b">Lưu lại mã đơn này. Bạn có thể tra cứu đơn bất cứ lúc nào tại <a href="${esc(baseUrl)}/orders/track">${esc(baseUrl)}/orders/track</a> bằng <strong>mã đơn</strong> và <strong>số điện thoại nhận hàng</strong> (${esc(order.ReceiverPhone)}).</p>
<h2 style="font-size:15px;margin:22px 0 6px">Sản phẩm</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
<tr><td style="padding-top:10px;font-size:14px;color:#475569">Tạm tính</td><td align="right" style="padding-top:10px;font-size:14px">${esc(fmtMoney(order.Subtotal))}</td></tr>
${order.DiscountAmount > 0 ? `<tr><td style="font-size:14px;color:#15803d">Giảm giá${order.PromoCode ? ` (${esc(order.PromoCode)})` : ''}</td><td align="right" style="font-size:14px;color:#15803d">-${esc(fmtMoney(order.DiscountAmount))}</td></tr>` : ''}
<tr><td style="font-size:14px;color:#475569">Phí vận chuyển</td><td align="right" style="font-size:14px">${Number(order.ShippingFee) === 0 ? 'Miễn phí' : esc(fmtMoney(order.ShippingFee))}</td></tr>
<tr><td style="font-size:14px;color:#475569">VAT</td><td align="right" style="font-size:14px">${esc(fmtMoney(order.VatAmount))}</td></tr>
<tr><td style="padding-top:8px;font-weight:800">Tổng thanh toán</td><td align="right" style="padding-top:8px;font-size:20px;font-weight:800;color:#c81e3a">${esc(fmtMoney(order.TotalAmount))}</td></tr></table>
<h2 style="font-size:15px;margin:22px 0 6px">Giao tới</h2>
<p style="margin:0;font-size:14px;line-height:1.6">${esc(order.ReceiverName)} · ${esc(order.ReceiverPhone)}<br>${esc(order.ShippingAddress)}</p>
<h2 style="font-size:15px;margin:22px 0 6px">Thanh toán — ${esc(PAYMENT_METHOD[order.PaymentMethod] || order.PaymentMethod)}</h2>
<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6">${pay.html}</div>
<p style="margin:22px 0 0;font-size:13px;color:#64748b">${order.Status === 'Pending' ? 'Đơn có từ 2 sản phẩm nên đang ở trạng thái <strong>Đang kiểm tra hàng</strong>; nhân viên sẽ liên hệ xác nhận tồn kho.' : 'Đơn đã được hệ thống <strong>xác nhận còn hàng</strong>.'}</p>`);
  const text = [
    `Cảm ơn bạn đã đặt hàng tại ${site.name}!`,
    `Mã đơn hàng: ${order.OrderNo}`,
    `Trạng thái: ${status.label}`,
    `Tổng thanh toán: ${fmtMoney(order.TotalAmount)}`,
    pay.text,
    `Tra cứu đơn: ${trackUrl}`,
    `(Tra cứu bằng mã đơn + số điện thoại nhận hàng ${order.ReceiverPhone})`,
  ].filter(Boolean).join('\n');
  return { subject: `Xác nhận đơn hàng ${order.OrderNo} - ${site.name}`, html, text };
}

/** Email "gửi lại mã đơn": liệt kê các đơn gần đây khớp SĐT + email. */
function orderCodesReminder(orders, baseUrl) {
  const rows = orders.map((o) => {
    const st = ORDER_STATUS[o.Status] || { label: o.Status };
    const url = `${baseUrl}/orders/track?orderNo=${encodeURIComponent(o.OrderNo)}&phone=${encodeURIComponent(o.ReceiverPhone)}`;
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f6"><a href="${esc(url)}" style="font-family:Consolas,monospace;font-weight:700;color:#4338ca;text-decoration:none">${esc(o.OrderNo)}</a><br><span style="font-size:12px;color:#64748b">${esc(fmtDateTime(o.CreatedAt))} · ${esc(st.label)}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef0f6"><strong>${esc(fmtMoney(o.TotalAmount))}</strong></td></tr>`;
  }).join('');
  const html = layout('Mã đơn hàng của bạn', `<h1 style="margin:0 0 8px;font-size:20px">Mã đơn hàng của bạn</h1>
<p style="margin:0 0 14px;color:#475569">Bạn (hoặc ai đó) vừa yêu cầu gửi lại mã đơn hàng. Các đơn gần đây khớp với số điện thoại và email này:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:18px 0 0;font-size:13px;color:#64748b">Nhấn vào mã đơn để xem chi tiết. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`);
  const text = `Mã đơn hàng gần đây của bạn:\n${orders.map((o) => `- ${o.OrderNo} (${(ORDER_STATUS[o.Status] || { label: o.Status }).label}, ${fmtMoney(o.TotalAmount)})`).join('\n')}\nTra cứu: ${baseUrl}/orders/track`;
  return { subject: `Mã đơn hàng của bạn - ${site.name}`, html, text };
}

/** Email "quên mật khẩu": link đặt lại mật khẩu, dùng 1 lần và hết hạn sau `minutes` phút. */
function passwordReset({ name, link, minutes }) {
  const html = layout('Đặt lại mật khẩu', `<h1 style="margin:0 0 8px;font-size:20px">Đặt lại mật khẩu</h1>
<p style="margin:0 0 16px;color:#475569">Xin chào <strong>${esc(name)}</strong>, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại ${esc(site.name)}.</p>
<p style="margin:0 0 18px">${button(link, 'Đặt mật khẩu mới')}</p>
<p style="margin:0 0 6px;font-size:13px;color:#64748b">Link chỉ dùng được <strong>một lần</strong> và hết hạn sau <strong>${esc(minutes)} phút</strong>. Nếu nút không bấm được, hãy dán địa chỉ sau vào trình duyệt:</p>
<p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#4338ca">${esc(link)}</p>
<p style="margin:0;font-size:13px;color:#64748b">Nếu bạn không yêu cầu, hãy bỏ qua email này - mật khẩu hiện tại vẫn giữ nguyên và không ai đăng nhập được nếu không có link này.</p>`);
  const text = `Xin chào ${name},\nĐặt lại mật khẩu ${site.name}: ${link}\nLink dùng 1 lần, hết hạn sau ${minutes} phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`;
  return { subject: `Đặt lại mật khẩu - ${site.name}`, html, text };
}

/** Email thông báo sau khi mật khẩu đã được đổi (để chủ tài khoản phát hiện nếu không phải mình làm). */
function passwordChanged({ name, when, how }) {
  const html = layout('Mật khẩu đã được thay đổi', `<h1 style="margin:0 0 8px;font-size:20px">Mật khẩu đã được thay đổi</h1>
<p style="margin:0 0 14px;color:#475569">Xin chào <strong>${esc(name)}</strong>, mật khẩu tài khoản của bạn tại ${esc(site.name)} vừa được ${esc(how)} lúc <strong>${esc(fmtDateTime(when))}</strong>.</p>
<p style="margin:0;font-size:13px;color:#64748b">Nếu không phải bạn thực hiện, hãy dùng chức năng "Quên mật khẩu" để đặt lại ngay và liên hệ ${esc(site.email)} hoặc hotline ${esc(site.hotline)}.</p>`);
  const text = `Xin chào ${name}, mật khẩu tài khoản ${site.name} của bạn vừa được ${how} lúc ${fmtDateTime(when)}. Nếu không phải bạn, hãy đặt lại mật khẩu ngay và liên hệ ${site.email}.`;
  return { subject: `Mật khẩu của bạn đã được thay đổi - ${site.name}`, html, text };
}

/** Email gửi mật khẩu tạm khi quản trị viên đặt lại mật khẩu: mật khẩu chỉ đi tới email của chủ tài khoản. */
function passwordTemp({ name, username, password }) {
  const html = layout('Mật khẩu tạm thời', `<h1 style="margin:0 0 8px;font-size:20px">Mật khẩu tạm thời</h1>
<p style="margin:0 0 14px;color:#475569">Xin chào <strong>${esc(name)}</strong>, quản trị viên vừa đặt lại mật khẩu tài khoản <strong>${esc(username)}</strong> của bạn tại ${esc(site.name)}.</p>
<p style="margin:0 0 14px;padding:14px 18px;background:#f1f5f9;border-radius:10px;font-family:Consolas,monospace;font-size:20px;font-weight:700;letter-spacing:.06em;text-align:center">${esc(password)}</p>
<p style="margin:0;font-size:13px;color:#64748b">Hãy đăng nhập bằng mật khẩu này rồi đổi sang mật khẩu của riêng bạn ngay. Các phiên đăng nhập cũ đã bị đăng xuất. Nếu bạn không mong đợi email này, hãy liên hệ ${esc(site.email)} hoặc hotline ${esc(site.hotline)}.</p>`);
  const text = `Xin chào ${name}, quản trị viên vừa đặt lại mật khẩu tài khoản ${username} tại ${site.name}. Mật khẩu tạm: ${password}. Hãy đăng nhập và đổi mật khẩu ngay.`;
  return { subject: `Mật khẩu tạm thời - ${site.name}`, html, text };
}

module.exports = { orderConfirmation, orderCodesReminder, passwordReset, passwordChanged, passwordTemp, esc };
