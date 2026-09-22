# Chia module (4 người)

Mỗi module = route → controller → model → view riêng, chỉ sửa file thuộc module mình. Route đã dựng sẵn, mở lên sẽ thấy checklist việc cần làm. Muốn tự chọn module, điền tên vào `docs/Module_Signup.xlsx`.

---
## Module 1 - Hệ thống & Kho
Khu vực: `/admin`, `/warehouse`, `/auth`.
- Admin: quản lý người dùng, phân quyền vai trò, nhật ký hệ thống, dashboard (đã có sẵn).
- Kho: nhà cung cấp, lập/chốt phiếu nhập kèm Serial, tồn kho, tra cứu serial.
- File: `routes/{admin,warehouse,auth}.routes.js`, `controllers/{admin,warehouse,auth}/`, `models/{account,role,audit,supplier,goodsReceipt,stock}.model.js`, `views/{admin,warehouse,auth}/`.
- Đã có sẵn: đăng nhập/đăng xuất, RBAC, audit.log, dashboard admin. Phần Kho có thể làm gọn nếu thiếu thời gian.

## Module 2 - Danh mục & Cửa hàng
Khu vực: `/` (công khai), `/staff/products|categories|brands|attributes`.
- Cửa hàng: danh sách sản phẩm (tìm/lọc/sắp xếp/phân trang), chi tiết sản phẩm, gợi ý linh kiện tương thích.
- Quản lý (NV bán hàng): CRUD sản phẩm, danh mục, thuộc tính kỹ thuật.
- File: `routes/{store,staff-catalog}.routes.js`, `controllers/{store,staff}/{home,product,category,brand,attribute}`, `models/{product,category,brand,attribute}.model.js`, `views/{store,staff/products,...}`.
- Đã có sẵn: trang chủ, **CRUD Thương hiệu hoàn chỉnh làm mẫu**.

## Module 3 - Khách mua hàng
Khu vực: `/register /account /cart /checkout /orders`.
- Đăng ký, hồ sơ + sổ địa chỉ, giỏ hàng, thanh toán, đặt hàng, lịch sử đơn, huỷ đơn.
- File: `routes/customer.routes.js`, `controllers/customer/`, `models/{customer,cart,checkout,customerOrder}.model.js`, `views/customer/`.
- Phụ thuộc M2 (trang sản phẩm gọi `POST /cart/add`); có thể test tạm bằng form riêng trong lúc chờ.

## Module 4 - Đơn hàng, hoá đơn & báo cáo
Khu vực: `/staff` (tổng quan), `/staff/orders|invoices|reports|warranty`.
- Duyệt/huỷ đơn, hoá đơn (xem/in), thống kê doanh thu + biểu đồ, tra cứu bảo hành.
- File: `routes/staff-sales.routes.js`, `controllers/staff/{dashboard,order,invoice,report,warranty}`, `models/{order,invoice,report,warranty}.model.js`, `views/staff/{orders,invoices,reports,warranty}`.
- Seed đã có đơn đủ trạng thái nên làm được ngay, không cần chờ M3.

---
## File dùng chung - báo nhóm trước khi sửa
`src/app.js`, `src/core/*`, `src/config/db.js`, `src/views/layouts/*`, `src/views/partials/*`, `public/css/app.css`, `database/*.sql`, `src/routes/{index,staff}.routes.js`.

## Quy tắc nghiệp vụ (đừng phá)
1. Đặt hàng giữ chỗ tồn (`Products.QtyReserved`); duyệt mới trừ `QtyOnHand`; huỷ đơn chờ → nhả giữ chỗ, huỷ đơn đã duyệt → trả tồn + trả serial + vô hiệu bảo hành/hoá đơn.
2. Sản phẩm `IsSerialTracked = 1`: serial tự gán khi duyệt đơn (nhập trước xuất trước), 1 serial không bán 2 lần.
3. Tồn kho, thanh toán nằm ngay trên `Products`/`Orders` (không có bảng `Inventory`/`Payments` riêng); lịch sử thao tác ghi qua `AuditLogs` dùng chung.
4. `Orders.VatAmount`, `TotalAmount` là cột tính toán - không INSERT/UPDATE trực tiếp.
