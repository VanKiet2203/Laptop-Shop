# Laptop Shop

Website bán laptop & linh kiện. **Node.js (Express + EJS) - mô hình MVC**, CSDL **SQL Server**.
4 khu vực riêng: Cửa hàng (`/`), Admin (`/admin`), Nhân viên bán hàng (`/staff`), Kho (`/warehouse`).

## 1. Cài đặt
Yêu cầu: **Node.js ≥ 18**, **SQL Server 2017+** (bật đăng nhập SQL - Mixed Mode).

1. Mở SSMS / Azure Data Studio, chạy lần lượt 3 file trong `database/`, **cùng một cửa sổ kết nối**:
   `01_schema.sql` → `02_programmability.sql` → `03_seed.sql`
   (`01` sẽ xoá & tạo lại database `LaptopShopDB`.)
2. `copy .env.example .env` rồi sửa `DB_USER`, `DB_PASSWORD`, `DB_SERVER` cho đúng máy bạn.
3. `npm install`
4. `npm run db:check` (kiểm tra kết nối) → `npm run dev` → mở http://localhost:3000

## 2. Tài khoản mẫu (mật khẩu chung `123456`)
| Tài khoản | Vai trò | Vào |
|---|---|---|
| `admin` | Quản trị | `/admin` |
| `sales1`, `sales2` | Nhân viên bán hàng | `/staff` |
| `kho1` | Nhân viên kho | `/warehouse` |
| `khach1`, `khach2`, `khach3` | Khách hàng | `/` |

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
- Route chưa code hiện trang "CHƯA TRIỂN KHAI" kèm checklist việc cần làm - làm xong thì thay bằng `res.render(...)`.
- Ví dụ mẫu để bắt chước: CRUD Thương hiệu (`routes/staff-catalog.routes.js`, `controllers/staff/brand.controller.js`, `models/brand.model.js`, `views/staff/brands/`).
- Ghi nhật ký thao tác quan trọng: `audit.log(req, 'ACTION', 'Entity', id, 'chi tiết')`.

## 5. Git & làm việc nhóm
Mỗi người 1 nhánh `module-1` … `module-4` (đã tạo sẵn), chỉ sửa file thuộc module của mình - xem `docs/MODULES.md` hoặc điền tên vào `docs/Module_Signup.xlsx`. File dùng chung (`core/`, `app.js`, `views/layouts`, `database/*.sql`) sửa thì báo cả nhóm.

Khi mở Pull Request về `main`, GitHub Actions tự kiểm tra code chạy được và không đụng file ngoài phạm vi module (xem `.github/workflows/`).


