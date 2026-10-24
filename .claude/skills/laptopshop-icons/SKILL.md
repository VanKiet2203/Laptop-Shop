---
name: laptopshop-icons
description: Bộ icon riêng (custom SVG sprite) và ngôn ngữ thiết kế nút/hiệu ứng của Laptop Shop. Load trước khi thêm/sửa bất kỳ icon, nút, dashboard hay trang chi tiết sản phẩm nào — người dùng đã yêu cầu rõ KHÔNG dùng icon có sẵn (Bootstrap Icons `bi bi-*`) vì trông "quá AI", và muốn nút/hiệu ứng bớt đơn giản.
---

# Laptop Shop — icon riêng & ngôn ngữ nút

**Yêu cầu của người dùng (24/10/2026):** không dùng icon có sẵn vì quá "AI"; nút, icon, hiệu ứng
đang quá đơn giản; dashboard và trang chi tiết sản phẩm phải thật đẹp. Mọi UI mới phải theo
hướng này, không quay lại `bi bi-*`.

## Icon

- Nguồn duy nhất: `public/icons/sprite.svg` (mỗi icon là một `<symbol id="i-<tên>">`, lưới 24×24).
- Dùng trong EJS bằng helper (định nghĩa ở `src/core/helpers.js`, đã có sẵn trong mọi view):
  `<%- ico('cart') %>` hoặc `<%- ico('arrow', 'ico-sm') %>`. Tên chỉ nhận `[a-z0-9-]` nên in raw an toàn.
- Cỡ/màu theo chữ xung quanh (`.ico` = 1.2em, `currentColor`); biến thể `.ico-sm`, `.ico-lg`.
- **Thêm icon mới = thêm `<symbol>` vào sprite**, KHÔNG kéo thêm thư viện icon.
- Phong cách "duotone vẽ tay": nét 1.75px, đầu nét bo tròn, thân icon có mảng nền cùng màu
  `fill="currentColor" fill-opacity=".14"`, thêm một chi tiết đặc (chấm/ổ khoá) bằng `fill="currentColor" stroke="none"`.
  Giữ đúng phong cách này khi vẽ icon mới (copy một symbol có sẵn làm khuôn).
- Icon chỉ-có-icon (nút tìm kiếm...) vẫn phải có `aria-label` ở nút; `ico()` đã `aria-hidden`.
- Tên hiện có: dash users user lock key log shield shieldcheck laptop cart cartplus search bag receipt doc chart
  trophy tree tag sliders box boxin truck boxes scan swap store logout ram cpu ssd check plus minus clock alert
  arrow bolt medal pulse logo.
- Sidebar: `panel.icon` và `nav[].icon` trong `layouts/*.ejs` là TÊN trong sprite (không còn tiền tố `bi-`).
- Còn một số view cũ dùng `bi bi-*` (customer/, staff/ forms...). Khi đụng vào view nào thì đổi sang `ico()` luôn.

## Nút ("keycap")

Nút đặc (`btn-primary/warning/danger/success/dark/light/secondary`) có "thành" dày 2px bên dưới và vạch sáng ở
mép trên: hover nhấc lên 1px, bấm lún xuống 2px (`--ls-edge` đổi được màu thành nút). Nút viền (`btn-outline-*`)
viền 1.5px, bấm co nhẹ. `.btn` là `inline-flex` nên đặt `<%- ico(...) %> Chữ` trực tiếp trong nút là tự cách đều.
Không thêm bóng mờ/gradient kiểu SaaS cho nút. Giữ focus ring mặc định của Bootstrap.

## "Dấu" nhận diện

Ô icon/logo/avatar có **một góc vát** (`border-radius: .75rem .75rem .75rem .2rem`) — dùng lặp lại cho
`.brand-mark`, `.kpi-icon`, `.pd-trust-ico`, `.avatar`. Đừng dùng hình tròn/vuông bo đều cho các ô này.

## Dashboard (xem `src/views/admin/dashboard.ejs` làm mẫu)

Cấu trúc: hero (lời chào + dòng trạng thái + lối tắt) → hàng KPI (`.kpi`, số đếm lên bằng `data-count`) →
biểu đồ cột theo giờ + thanh ngang → timeline hoạt động. Quy tắc biểu đồ (theo skill `dataviz`):
một hue duy nhất lấy từ `--ls-accent` của khu vực, cột đỉnh đậm – còn lại mờ, đầu cột bo 4px, có tooltip
(`data-tip`, hiện khi hover **và** focus bàn phím), luôn có `<details>` dạng bảng, có empty-state khi không có dữ liệu.
Dữ liệu biểu đồ tính ở controller (điền đủ 24 giờ, kể cả giờ 0), view chỉ vẽ. Hiệu ứng JS tôn trọng
`prefers-reduced-motion`. Staff/Warehouse dashboard làm tương tự, đổi `.kpi-*` theo màu khu vực.

## Trang chi tiết sản phẩm (`src/views/store/product-detail.ejs`)

Cột trái: `.pd-stage` (nền lưới kỹ thuật + 2 góc khung) + `.pd-thumbs` đổi ảnh bằng JS (`app.js`);
cột phải: hãng + SKU (`.part-no`), tiêu đề, `.pd-price-box`, `.stock-pill` (ok/low ≤5/out), `.pd-trust` (CHỈ nêu
thông tin có trong dữ liệu: bảo hành, serial, tồn kho — không bịa "giao hàng 2h", "chính hãng 100%"),
ô số lượng `.qty` có -/+ (max = tồn kho), nút `.btn-buy`. Thông số kỹ thuật là `.spec-grid` riêng, tách khỏi
phần "Linh kiện tương thích" (trước đây phần tương thích bị lồng trong `if (attributes.length)` nên mất khi không có thuộc tính).

## Kiểm tra trước khi xong

- Render thử template bằng `ejs.renderFile` với dữ liệu giả (không cần SQL Server) để bắt lỗi cú pháp.
- Mọi giá trị DB trong view vẫn `<%= %>`; chỉ `ico()` và `include` mới dùng `<%- %>`.
- Sprite phải là XML hợp lệ (`[xml](Get-Content sprite.svg)`).
