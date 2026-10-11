# Laptop Shop — Interface design system

Ghi nhớ theo quy trình của skill `interface-design` (xem `references/validation.md`).
Đọc file này trước khi thiết kế trang mới; mở rộng khi có pattern dùng lại ≥2 lần,
đừng tạo thêm biến thể khi pattern đã có sẵn ở đây.

## Direction & feel

Quầy linh kiện máy tính vận hành tốt, không phải landing page SaaS: chính xác,
có nhãn rõ ràng, trạng thái luôn nhìn thấy ngay. Tự tin qua sự rõ ràng, không
qua trang trí. Chi tiết đầy đủ ở skill `laptopshop-interface-design`.

## Depth strategy: LAYERED SHADOWS

Dùng xuyên suốt, không trộn với kiểu chỉ-viền. Token trong `public/css/app.css`:
`--ls-shadow-sm/md/lg` (nhiều lớp: viền mờ 0.5px + 2 lớp shadow).

## Spacing base

Thang spacing mặc định của Bootstrap (bội số 4px): `.p-1`…`.p-5`, `.g-3`. Không
dùng giá trị margin/padding tuỳ ý kiểu `13px`.

## Border radius scale

- `--ls-radius-sm` (.55rem) — nút, input, badge
- `--ls-radius` (.75rem) — card, bảng, hero, `.btn-lg`

## Màu nhấn theo khu vực (đã code trong app.css)

| Khu vực | Accent | Dùng cho |
|---|---|---|
| Cửa hàng (`body.store`) | Bootstrap blue/purple gradient (`.hero`) | CTA chính, link |
| `/admin` | `#1f2937` (slate) | `.btn-primary`, link trong `.content` |
| `/staff` | `#0f766e` (teal) | `.btn-primary`, link trong `.content` |
| `/warehouse` | `#9a3412` (rust) | `.btn-primary`, link trong `.content` |

Không dùng xanh Bootstrap mặc định cho nút chính bên trong 3 khu vực trên.

## Button patterns

- `.btn-primary/.btn-warning/.btn-danger/.btn-success`: border: 0, gradient phủ nhẹ
  trên xuống (`linear-gradient(180deg, rgba(255,255,255,.16), transparent 55%)`),
  `box-shadow: var(--ls-shadow-sm)` mặc định, nâng lên `--ls-shadow-md` + glow màu
  riêng khi hover/focus.
- Mọi `.btn` nhấc `translateY(-1px)` khi hover, lún `scale(.97)` + `brightness(.96)`
  khi active. KHÔNG override focus-visible ring (người dùng Kho dùng bàn phím/máy quét).

## Signature pattern: `.part-no`

SKU/Serial/mã đơn/mã hoá đơn/mã phiếu nhập → `<span class="part-no">...</span>`
(monospace, nền xám nhạt, bo góc nhỏ). Số liệu dạng cột (giá, số lượng, thống kê)
→ thêm class `.tabular-nums`.

## Trang chưa code (`partials/todo.ejs`)

Card có vạch cam trên cùng (`.todo-card`), icon tròn nền cam nhạt (`.todo-icon`),
route hiển thị bằng `.part-no`. KHÔNG phải giao diện thật — `/products`, `/cart`,
`/register` hiện vẫn render qua đây vì controller chưa code (xem TODO trong
`src/controllers/store/product.controller.js`, `cart.controller.js`,
`customer/register.controller.js`).

## Chưa làm / cần quyết định tiếp

Trang sản phẩm (tìm kiếm/lọc/phân trang thật), giỏ hàng, đăng ký vẫn là khung
"todo" — CSS không sửa được vì chưa có HTML/logic thật. Cần implement
`Product.search()`, `Cart` model, `Customer.register()` trước khi áp style.
