# Laptop Shop

Website bán laptop & linh kiện. **Node.js (Express + EJS) - mô hình MVC**, CSDL **SQL Server**.
4 khu vực riêng: Cửa hàng (`/`), Admin (`/admin`), Nhân viên bán hàng (`/staff`), Kho (`/warehouse`).

## 1. Cài đặt

Yêu cầu: **Node.js ≥ 18**, **SQL Server 2017+** (bật đăng nhập SQL - Mixed Mode).

1. Mở SSMS / Azure Data Studio, chạy lần lượt 3 file trong `database/`, **cùng một cửa sổ kết nối**:
   `01_schema.sql` → `02_programmability.sql` → `03_seed.sql`
   (`01` sẽ xoá & tạo lại database `LaptopShopDB`.)
2. `copy .env.example .env` rồi sửa `DB_USER`, `DB_PASSWORD`, `DB_SERVER` cho đúng máy bạn.
   (Dùng login SQL `laptopshop_app`? `03_seed.sql` tự tạo lại user + quyền trong database sau mỗi lần chạy lại `01_schema.sql`, nên không còn lỗi *Login failed*.)
3. `npm install`
4. `npm run db:check` (kiểm tra kết nối) → `npm run dev` → mở http://localhost:3000

### Tuỳ chọn: đăng nhập Google & email xác nhận đơn

- **Đăng nhập Google**: điền `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` trong `.env` (xem hướng dẫn ngay trong `.env.example`). Chưa điền thì nút Google báo chưa cấu hình, các cách đăng nhập khác vẫn dùng bình thường.
- **Quên mật khẩu / đổi mật khẩu**: `/auth/forgot` gửi link đặt lại (dùng 1 lần, hết hạn 60 phút, lưu bản băm trong bảng `PasswordResets`), `/auth/password` cho mọi vai trò đổi mật khẩu khi đã đăng nhập; đổi mật khẩu (tự đổi, qua link email hoặc do admin đặt lại) thì **mọi phiên đăng nhập khác của tài khoản đó bị đăng xuất** (cột `Accounts.PasswordChangedAt` + `pwv` trong session, kiểm tra ở `requireLogin`); cả hai gửi email thông báo nên cần `SMTP_*` (không có thì email nằm trong `outbox/`, mở file ra lấy link). Ai khác chạy lại 3 file SQL vì có thêm bảng này.
- **Email xác nhận đơn + gửi lại mã đơn**: điền `SMTP_*` trong `.env`. Chưa điền thì email được lưu thành file HTML trong thư mục `outbox/` (để demo/kiểm tra nội dung).

## 2. Tài khoản mẫu (mật khẩu chung `123456`)

| Tài khoản                    | Vai trò            | Vào          |
| ---------------------------- | ------------------ | ------------ |
| `admin`                      | Quản trị           | `/admin`     |
| `sales1`, `sales2`           | Nhân viên bán hàng | `/staff`     |
| `kho1`                       | Nhân viên kho      | `/warehouse` |
| `khach1`, `khach2`, `khach3` | Khách hàng         | `/`          |

## 3. Cấu trúc thư mục

```
database/   01_schema.sql, 02_programmability.sql (trigger/view/proc), 03_seed.sql
docs/       MODULES.md (chia module), DATABASE_DICTIONARY.md (từ điển dữ liệu, tự sinh),
            Module_Signup.xlsx (bảng để từng người tự chọn module)
src/
  server.js, app.js   khởi động + cấu hình Express
  config/db.js        kết nối SQL Server
  core/                auth (RBAC), locals (flash, layout), todo
  routes/              1 file / khu vực
  controllers/         nhận request → gọi model → render view
  models/               NƠI DUY NHẤT chứa SQL
  views/                layouts/, partials/, view theo khu vực
```

## 4. Quy ước code

- Controller không viết SQL; SQL nằm trong `models/`, luôn dùng tham số `@name`.
- Nghiệp vụ nhiều bước (đặt/duyệt/huỷ đơn, chốt phiếu nhập) nằm trong **stored procedure**, Node chỉ gọi `db.exec(...)`.
- Toàn bộ route của 3 khu vực quản trị đã có chức năng thật (không còn trang "CHƯA TRIỂN KHAI"): **Bán hàng** (tổng quan, đơn hàng, hoá đơn + in, tra cứu bảo hành, thống kê doanh thu, sản phẩm bán chạy/lợi nhuận), **Kho** (nhà cung cấp, tồn kho, tra cứu Serial, sổ kho, phiếu nhập nháp → chốt/huỷ + in) và **Admin** (tài khoản, vai trò & phân quyền, nhật ký). `core/todo.js` chỉ còn để dùng khi cần dựng khung cho chức năng mới.
- Danh sách có lọc + phân trang dùng chung `views/partials/pager.ejs` và `paginate()` trong `core/helpers.js`; mọi bộ lọc đi qua hàm `normalizeFilters()` của model (chỉ nhận giá trị trong danh sách cho phép).
- Ví dụ mẫu để bắt chước: CRUD Thương hiệu (`routes/staff-catalog.routes.js`, `controllers/staff/brand.controller.js`, `models/brand.model.js`, `views/staff/brands/`).
- Ghi nhật ký thao tác quan trọng: `audit.log(req, 'ACTION', 'Entity', id, 'chi tiết')`.

## 5. Git & làm việc nhóm

Mỗi người 1 nhánh `module-1` … `module-4` (đã tạo sẵn), chỉ sửa file thuộc module của mình - xem `docs/MODULES.md` hoặc điền tên vào `docs/Module_Signup.xlsx`. File dùng chung (`core/`, `app.js`, `views/layouts`, `database/*.sql`) sửa thì báo cả nhóm.

Khi mở Pull Request về `main`, GitHub Actions tự kiểm tra code chạy được và không đụng file ngoài phạm vi module (xem `.github/workflows/`).
