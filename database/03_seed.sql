/* =====================================================================
   File 03: DỮ LIỆU MẪU (demo)
   Tài khoản test - mật khẩu tất cả: 123456
     admin    (ADMIN)      -> /admin
     sales1, sales2 (SALES)     -> /staff       (nhân viên bán hàng)
     kho1     (WAREHOUSE)  -> /warehouse   (nhân viên kho)
     khach1, khach2, khach3 (CUSTOMER) -> cửa hàng /
   ===================================================================== */
USE LaptopShopDB;
GO
SET NOCOUNT ON;

/* ---------- 1. Vai trò / quyền ---------- */
INSERT INTO dbo.Roles (RoleCode, RoleName, Description) VALUES
 ('ADMIN',     N'Quản trị hệ thống',      N'Quản lý người dùng, phân quyền, nhật ký hệ thống'),
 ('SALES',     N'Nhân viên bán hàng',     N'Duyệt/huỷ đơn, hoá đơn, quản lý sản phẩm, xem báo cáo'),
 ('WAREHOUSE', N'Nhân viên kho',          N'Nhà cung cấp, phiếu nhập kho, serial, tồn kho'),
 ('CUSTOMER',  N'Khách hàng',             N'Mua hàng trên website');

INSERT INTO dbo.Permissions (PermCode, PermName, ModuleName) VALUES
 ('dashboard.admin', N'Xem dashboard quản trị', N'Hệ thống'),
 ('user.manage',     N'Quản lý người dùng',     N'Hệ thống'),
 ('role.manage',     N'Quản lý vai trò & quyền',N'Hệ thống'),
 ('audit.view',      N'Xem nhật ký hệ thống',   N'Hệ thống'),
 ('product.view',    N'Xem sản phẩm',           N'Sản phẩm'),
 ('product.create',  N'Thêm sản phẩm',          N'Sản phẩm'),
 ('product.update',  N'Sửa sản phẩm',           N'Sản phẩm'),
 ('product.delete',  N'Xoá sản phẩm',           N'Sản phẩm'),
 ('category.manage', N'Quản lý danh mục',       N'Sản phẩm'),
 ('brand.manage',    N'Quản lý thương hiệu',    N'Sản phẩm'),
 ('order.view',      N'Xem đơn hàng',           N'Bán hàng'),
 ('order.approve',   N'Duyệt đơn hàng',         N'Bán hàng'),
 ('order.cancel',    N'Huỷ đơn hàng',           N'Bán hàng'),
 ('invoice.view',    N'Xem hoá đơn',            N'Bán hàng'),
 ('invoice.print',   N'In hoá đơn',             N'Bán hàng'),
 ('report.view',     N'Xem thống kê báo cáo',   N'Bán hàng'),
 ('warranty.view',   N'Tra cứu bảo hành',       N'Bán hàng'),
 ('supplier.manage', N'Quản lý nhà cung cấp',   N'Kho'),
 ('receipt.create',  N'Lập phiếu nhập kho',     N'Kho'),
 ('receipt.post',    N'Chốt phiếu nhập kho',    N'Kho'),
 ('stock.view',      N'Xem tồn kho / serial',   N'Kho'),
 ('chat.reply',      N'Trả lời chat khách hàng', N'Bán hàng'),
 ('shop.buy',        N'Mua hàng',               N'Cửa hàng');

INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, p.PermissionId FROM dbo.Roles r JOIN dbo.Permissions p ON
   (r.RoleCode='ADMIN'     AND p.PermCode IN ('dashboard.admin','user.manage','role.manage','audit.view'))
OR (r.RoleCode='SALES'     AND p.PermCode IN ('product.view','product.create','product.update','product.delete','category.manage','brand.manage',
                                              'order.view','order.approve','order.cancel','invoice.view','invoice.print','report.view','warranty.view','stock.view','chat.reply'))
OR (r.RoleCode='WAREHOUSE' AND p.PermCode IN ('product.view','supplier.manage','receipt.create','receipt.post','stock.view'))
OR (r.RoleCode='CUSTOMER'  AND p.PermCode IN ('shop.buy'));

/* ---------- 2. Tài khoản / nhân viên / khách hàng ---------- */
DECLARE @pw VARCHAR(100) = '$2a$10$aIj0Aka6.Kx51wcOrJBjv./ehFPfPSB/LpdLQ3qCXOhxsEPXDfxRq';  -- bcrypt("123456")
INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId)
SELECT v.u, v.e, @pw, r.RoleId FROM (VALUES
 ('admin',  'admin@laptopshop.vn',  'ADMIN'),
 ('sales1', 'sales1@laptopshop.vn', 'SALES'),
 ('sales2', 'sales2@laptopshop.vn', 'SALES'),
 ('kho1',   'kho1@laptopshop.vn',   'WAREHOUSE'),
 ('khach1', 'khach1@gmail.com',     'CUSTOMER'),
 ('khach2', 'khach2@gmail.com',     'CUSTOMER'),
 ('khach3', 'khach3@gmail.com',     'CUSTOMER')) v(u,e,rc)
JOIN dbo.Roles r ON r.RoleCode = v.rc;

INSERT INTO dbo.Employees (AccountId, EmployeeCode, FullName, Phone, Gender, BirthDate, Address, HireDate)
SELECT a.AccountId, v.code, v.fn, v.ph, v.g, v.bd, v.ad, v.hd FROM (VALUES
 ('sales1','NV001',N'Nguyễn Khánh Duy',   '0901000001',1,'2003-05-12',N'Quận 5, TP.HCM','2025-01-10'),
 ('sales2','NV002',N'Trần Phúc Tấn',      '0901000002',1,'2003-08-21',N'Quận 10, TP.HCM','2025-03-01'),
 ('kho1',  'NV003',N'Bùi Nguyễn Quốc Huy','0901000003',1,'2003-11-02',N'Quận 3, TP.HCM','2025-02-15'))
 v(u,code,fn,ph,g,bd,ad,hd) JOIN dbo.Accounts a ON a.Username = v.u;

-- Nhân viên HỆ THỐNG (NV000): đứng tên khi hệ thống tự xác nhận đơn 1 sản phẩm (sp_PlaceOrder -> sp_ApproveOrder @Auto = 1).
-- PasswordHash '!' không phải bcrypt hợp lệ nên không ai đăng nhập được bằng tài khoản này.
INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId)
SELECT 'system', NULL, '!', r.RoleId FROM dbo.Roles r WHERE r.RoleCode = 'SALES';
INSERT INTO dbo.Employees (AccountId, EmployeeCode, FullName, HireDate)
SELECT AccountId, 'NV000', N'Hệ thống tự động', '2025-01-01' FROM dbo.Accounts WHERE Username = 'system';

INSERT INTO dbo.MembershipTiers (TierName, MinPoints, DiscountPercent) VALUES
 (N'Thường',0,0),(N'Bạc',1000,2),(N'Vàng',5000,3),(N'Kim cương',10000,5);

INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email, CompanyName, TaxCode)
SELECT a.AccountId, v.fn, v.ph, v.em, v.co, v.tx FROM (VALUES
 ('khach1',N'Nguyễn Văn Kiệt','0912000001','khach1@gmail.com',NULL,NULL),
 ('khach2',N'Lê Thị Hoa',     '0912000002','khach2@gmail.com',N'Công ty TNHH Hoa Việt','0312345678'),
 ('khach3',N'Phạm Minh Tuấn', '0912000003','khach3@gmail.com',NULL,NULL)) v(u,fn,ph,em,co,tx)
JOIN dbo.Accounts a ON a.Username = v.u;
INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email) VALUES
 (NULL, N'Khách vãng lai - Võ Thanh Sơn', '0913000004', NULL),
 (NULL, N'Khách vãng lai - Đặng Mỹ Linh',  '0913000005', 'linh.dang@gmail.com');

INSERT INTO dbo.CustomerAddresses (CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault)
SELECT c.CustomerId, v.rn, v.rp, v.al, v.w, v.d, v.p, v.def FROM (VALUES
 ('0912000001',N'Nguyễn Văn Kiệt','0912000001',N'273 An Dương Vương',N'Phường 3',N'Quận 5',N'TP. Hồ Chí Minh',1),
 ('0912000002',N'Lê Thị Hoa','0912000002',N'12 Nguyễn Huệ',N'Bến Nghé',N'Quận 1',N'TP. Hồ Chí Minh',1),
 ('0912000002',N'Kho Hoa Việt','0912999999',N'45 Lê Văn Việt',N'Hiệp Phú',N'TP. Thủ Đức',N'TP. Hồ Chí Minh',0),
 ('0912000003',N'Phạm Minh Tuấn','0912000003',N'88 Trần Hưng Đạo',N'Phường 7',N'Quận 5',N'TP. Hồ Chí Minh',1))
 v(ph,rn,rp,al,w,d,p,def) JOIN dbo.Customers c ON c.Phone = v.ph;

/* ---------- 3. Danh mục / thương hiệu / thuộc tính ---------- */
INSERT INTO dbo.Categories (ParentId, CategoryName, Slug, SortOrder) VALUES
 (NULL, N'Laptop', 'laptop', 1), (NULL, N'Linh kiện', 'linh-kien', 2), (NULL, N'Phụ kiện', 'phu-kien', 3);
INSERT INTO dbo.Categories (ParentId, CategoryName, Slug, SortOrder)
SELECT p.CategoryId, v.n, v.s, v.o FROM (VALUES
 ('laptop',N'Laptop Gaming','laptop-gaming',1),('laptop',N'Laptop Văn phòng','laptop-van-phong',2),('laptop',N'Laptop Đồ hoạ','laptop-do-hoa',3),
 ('linh-kien',N'RAM','ram',1),('linh-kien',N'Ổ cứng SSD','ssd',2),
 ('phu-kien',N'Chuột','chuot',1),('phu-kien',N'Bàn phím','ban-phim',2),('phu-kien',N'Tai nghe','tai-nghe',3),
 ('phu-kien',N'Balo - Túi','balo',4),('phu-kien',N'Sạc - Cáp','sac-cap',5)) v(ps,n,s,o)
JOIN dbo.Categories p ON p.Slug = v.ps;

INSERT INTO dbo.Brands (BrandName, Country) VALUES
 (N'Asus',N'Đài Loan'),(N'Dell',N'Mỹ'),(N'HP',N'Mỹ'),(N'Lenovo',N'Trung Quốc'),(N'Apple',N'Mỹ'),(N'MSI',N'Đài Loan'),
 (N'Kingston',N'Mỹ'),(N'Samsung',N'Hàn Quốc'),(N'Crucial',N'Mỹ'),(N'Logitech',N'Thụy Sĩ'),(N'Razer',N'Mỹ'),
 (N'Corsair',N'Mỹ'),(N'Anker',N'Trung Quốc');

INSERT INTO dbo.Attributes (AttrCode, AttrName, Unit, IsFilterable) VALUES
 ('CPU',N'Bộ vi xử lý',NULL,0),('GPU',N'Card đồ hoạ',NULL,0),('RAM_SIZE',N'Dung lượng RAM',N'GB',1),
 ('RAM_TYPE',N'Chuẩn RAM',NULL,1),('RAM_SLOTS',N'Số khe RAM',NULL,0),
 ('RAM_UPGRADABLE',N'RAM có thể nâng cấp',NULL,1), -- Có/Không - máy hàn chết RAM (onboard) phải đặt 'Không' dù vẫn có RAM_TYPE
 ('STORAGE',N'Ổ cứng',NULL,0),
 ('SSD_INTERFACE',N'Chuẩn giao tiếp SSD',NULL,1),('SCREEN',N'Màn hình',N'inch',0),('REFRESH_RATE',N'Tần số quét',N'Hz',0),
 ('WEIGHT',N'Trọng lượng',N'kg',0),('CAPACITY',N'Dung lượng lưu trữ',N'GB',0),('CONNECTION',N'Kết nối',NULL,1),('DPI',N'Độ nhạy',N'DPI',0);

/* ---------- 4. Sản phẩm ---------- */
INSERT INTO dbo.Products (Sku, ProductName, Slug, CategoryId, BrandId, ShortDesc, CostPrice, SalePrice, WarrantyMonths, IsSerialTracked)
SELECT v.sku, v.n, v.slug, c.CategoryId, b.BrandId, v.sd, v.cost, v.price, v.war, v.ser
FROM (VALUES
 ('ASUS-TUF-F15',  N'Asus TUF Gaming F15 FX507ZC4','asus-tuf-gaming-f15','laptop-gaming',N'Asus',N'i5-12500H, RTX 3050, 144Hz',20500000,24990000,24,1),
 ('MSI-KATANA-15', N'MSI Katana 15 B13VEK',        'msi-katana-15',      'laptop-gaming',N'MSI', N'i7-13620H, RTX 4050, 144Hz',22000000,26990000,24,1),
 ('LENOVO-LOQ-15', N'Lenovo LOQ 15IAX9',           'lenovo-loq-15',      'laptop-gaming',N'Lenovo',N'i5-12450HX, RTX 3050',19000000,22990000,24,1),
 ('DELL-INS-15',   N'Dell Inspiron 15 3520',       'dell-inspiron-15',   'laptop-van-phong',N'Dell',N'i5-1235U, 8GB, 512GB',11500000,13990000,24,1),
 ('HP-15S',        N'HP 15s-fq5229TU',             'hp-15s-fq5229tu',    'laptop-van-phong',N'HP',N'i5-1235U, 8GB, 512GB',10500000,12990000,24,1),
 ('LENOVO-IDEA5',  N'Lenovo IdeaPad Slim 5 14IAH8','lenovo-ideapad-slim-5','laptop-van-phong',N'Lenovo',N'i5-12450H, 16GB, 512GB',14500000,17490000,24,1),
 ('MBA-M2',        N'MacBook Air M2 13 inch 8GB/256GB','macbook-air-m2', 'laptop-van-phong',N'Apple',N'Chip Apple M2, 8GB, 256GB',21500000,24990000,12,1),
 ('ASUS-VIVO-PRO', N'Asus Vivobook Pro 15 OLED',   'asus-vivobook-pro-15','laptop-do-hoa',N'Asus',N'Ryzen 7, RTX 3050, OLED',23500000,27990000,24,1),
 ('DELL-XPS-15',   N'Dell XPS 15 9530',            'dell-xps-15-9530',   'laptop-do-hoa',N'Dell',N'i7-13700H, RTX 4050, OLED 3.5K',42000000,47990000,24,1),
 ('KVR-D4-8',      N'Kingston Fury Impact 8GB DDR4 3200 SODIMM','kingston-fury-8gb-ddr4','ram',N'Kingston',N'RAM laptop DDR4 8GB',550000,750000,36,1),
 ('KVR-D5-16',     N'Kingston Fury Impact 16GB DDR5 5600 SODIMM','kingston-fury-16gb-ddr5','ram',N'Kingston',N'RAM laptop DDR5 16GB',1450000,1890000,36,1),
 ('CRU-D5-8',      N'Crucial 8GB DDR5 4800 SODIMM','crucial-8gb-ddr5',   'ram',N'Crucial',N'RAM laptop DDR5 8GB',750000,990000,36,1),
 ('SAM-980-500',   N'Samsung 980 500GB NVMe M.2',  'samsung-980-500gb',  'ssd',N'Samsung',N'SSD NVMe PCIe 3.0 500GB',1100000,1450000,36,1),
 ('SAM-980P-1TB',  N'Samsung 980 Pro 1TB NVMe PCIe 4.0','samsung-980-pro-1tb','ssd',N'Samsung',N'SSD NVMe PCIe 4.0 1TB',2300000,2890000,36,1),
 ('KIN-A400-480',  N'Kingston A400 480GB SATA 2.5','kingston-a400-480gb','ssd',N'Kingston',N'SSD SATA 2.5 inch 480GB',700000,920000,36,1),
 ('LOGI-G102',     N'Chuột Logitech G102 Lightsync','logitech-g102',     'chuot',N'Logitech',N'Chuột gaming có dây 8000 DPI',250000,399000,12,0),
 ('LOGI-MXM3S',    N'Chuột Logitech MX Master 3S', 'logitech-mx-master-3s','chuot',N'Logitech',N'Chuột không dây cao cấp 8000 DPI',1600000,2190000,12,0),
 ('RAZER-DAV3',    N'Chuột Razer DeathAdder V3',   'razer-deathadder-v3','chuot',N'Razer',N'Chuột gaming 30000 DPI',1300000,1690000,24,0),
 ('CORSAIR-K70',   N'Bàn phím cơ Corsair K70 RGB TKL','corsair-k70-tkl', 'ban-phim',N'Corsair',N'Bàn phím cơ TKL, switch Cherry MX',2000000,2590000,24,0),
 ('LOGI-K380',     N'Bàn phím Logitech K380 Bluetooth','logitech-k380',  'ban-phim',N'Logitech',N'Bàn phím không dây mỏng nhẹ',550000,790000,12,0),
 ('RAZER-BSV2X',   N'Tai nghe Razer BlackShark V2 X','razer-blackshark-v2x','tai-nghe',N'Razer',N'Tai nghe gaming 7.1',1000000,1490000,12,0),
 ('ASUS-ROG-BP',   N'Balo Asus ROG Ranger BP2500', 'asus-rog-ranger-bp2500','balo',N'Asus',N'Balo laptop gaming 15.6 inch',700000,990000,12,0),
 ('ANKER-737',     N'Sạc Anker 737 GaNPrime 120W', 'anker-737-120w',     'sac-cap',N'Anker',N'Sạc nhanh 3 cổng 120W',1100000,1590000,18,0),
 ('ANKER-PL3',     N'Cáp Anker PowerLine III USB-C 1.8m','anker-powerline-iii','sac-cap',N'Anker',N'Cáp sạc USB-C bền bỉ',150000,249000,18,0)
) v(sku,n,slug,cat,brand,sd,cost,price,war,ser)
JOIN dbo.Categories c ON c.Slug = v.cat
JOIN dbo.Brands b ON b.BrandName = v.brand;

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, IsPrimary, SortOrder)
SELECT ProductId, '/images/placeholder.svg', 1, 0 FROM dbo.Products;

-- Ảnh thật cho 24 sản phẩm mẫu (đã tải về public/images/products/, lấy từ trang bán lẻ - dùng cho đồ án học tập)
UPDATE i SET i.ImageUrl = v.url
FROM dbo.ProductImages i
JOIN dbo.Products p ON p.ProductId = i.ProductId
JOIN (VALUES
  ('KVR-D4-8','/images/products/kvr-d4-8.png'),
  ('KVR-D5-16','/images/products/kvr-d5-16.png'),
  ('CRU-D5-8','/images/products/cru-d5-8.png'),
  ('SAM-980-500','/images/products/sam-980-500.jpg'),
  ('SAM-980P-1TB','/images/products/sam-980p-1tb.jpg'),
  ('KIN-A400-480','/images/products/kin-a400-480.jpg'),
  ('LOGI-G102','/images/products/logi-g102.jpg'),
  ('LOGI-MXM3S','/images/products/logi-mxm3s.jpg'),
  ('RAZER-DAV3','/images/products/razer-dav3.jpg'),
  ('CORSAIR-K70','/images/products/corsair-k70.png'),
  ('LOGI-K380','/images/products/logi-k380.jpg'),
  ('RAZER-BSV2X','/images/products/razer-bsv2x.png'),
  ('ASUS-ROG-BP','/images/products/asus-rog-bp.png'),
  ('ANKER-737','/images/products/anker-737.webp'),
  ('ANKER-PL3','/images/products/anker-pl3.jpg'),
  ('ASUS-TUF-F15','/images/products/asus-tuf-f15.webp'),
  ('MSI-KATANA-15','/images/products/msi-katana-15.webp'),
  ('LENOVO-LOQ-15','/images/products/lenovo-loq-15.png'),
  ('DELL-INS-15','/images/products/dell-ins-15.webp'),
  ('HP-15S','/images/products/hp-15s.png'),
  ('LENOVO-IDEA5','/images/products/lenovo-idea5.png'),
  ('MBA-M2','/images/products/mba-m2.jpg'),
  ('ASUS-VIVO-PRO','/images/products/asus-vivo-pro.jpg'),
  ('DELL-XPS-15','/images/products/dell-xps-15.jpg')
) v(sku, url) ON v.sku = p.Sku
WHERE i.IsPrimary = 1;


-- Thuộc tính kỹ thuật (Sku, mã thuộc tính, giá trị)
INSERT INTO dbo.ProductAttributeValues (ProductId, AttributeId, AttrValue)
SELECT p.ProductId, a.AttributeId, v.val FROM (VALUES
 ('ASUS-TUF-F15','CPU',N'Intel Core i5-12500H'),('ASUS-TUF-F15','GPU',N'NVIDIA RTX 3050 4GB'),('ASUS-TUF-F15','RAM_SIZE',N'8'),('ASUS-TUF-F15','RAM_TYPE',N'DDR5'),('ASUS-TUF-F15','RAM_SLOTS',N'2 khe (1 trống)'),('ASUS-TUF-F15','RAM_UPGRADABLE',N'Có'),('ASUS-TUF-F15','STORAGE',N'512GB NVMe'),('ASUS-TUF-F15','SSD_INTERFACE',N'M.2 NVMe'),('ASUS-TUF-F15','SCREEN',N'15.6'),('ASUS-TUF-F15','REFRESH_RATE',N'144'),('ASUS-TUF-F15','WEIGHT',N'2.2'),
 ('MSI-KATANA-15','CPU',N'Intel Core i7-13620H'),('MSI-KATANA-15','GPU',N'NVIDIA RTX 4050 6GB'),('MSI-KATANA-15','RAM_SIZE',N'16'),('MSI-KATANA-15','RAM_TYPE',N'DDR5'),('MSI-KATANA-15','RAM_SLOTS',N'2 khe (0 trống)'),('MSI-KATANA-15','RAM_UPGRADABLE',N'Có'),('MSI-KATANA-15','STORAGE',N'1TB NVMe'),('MSI-KATANA-15','SSD_INTERFACE',N'M.2 NVMe'),('MSI-KATANA-15','SCREEN',N'15.6'),('MSI-KATANA-15','REFRESH_RATE',N'144'),('MSI-KATANA-15','WEIGHT',N'2.25'),
 ('LENOVO-LOQ-15','CPU',N'Intel Core i5-12450HX'),('LENOVO-LOQ-15','GPU',N'NVIDIA RTX 3050 6GB'),('LENOVO-LOQ-15','RAM_SIZE',N'12'),('LENOVO-LOQ-15','RAM_TYPE',N'DDR5'),('LENOVO-LOQ-15','RAM_SLOTS',N'2 khe (0 trống)'),('LENOVO-LOQ-15','RAM_UPGRADABLE',N'Có'),('LENOVO-LOQ-15','STORAGE',N'512GB NVMe'),('LENOVO-LOQ-15','SSD_INTERFACE',N'M.2 NVMe'),('LENOVO-LOQ-15','SCREEN',N'15.6'),('LENOVO-LOQ-15','REFRESH_RATE',N'144'),('LENOVO-LOQ-15','WEIGHT',N'2.38'),
 ('DELL-INS-15','CPU',N'Intel Core i5-1235U'),('DELL-INS-15','RAM_SIZE',N'8'),('DELL-INS-15','RAM_TYPE',N'DDR4'),('DELL-INS-15','RAM_SLOTS',N'2 khe (1 trống)'),('DELL-INS-15','RAM_UPGRADABLE',N'Có'),('DELL-INS-15','STORAGE',N'512GB NVMe'),('DELL-INS-15','SSD_INTERFACE',N'M.2 NVMe'),('DELL-INS-15','SCREEN',N'15.6'),('DELL-INS-15','WEIGHT',N'1.65'),
 ('HP-15S','CPU',N'Intel Core i5-1235U'),('HP-15S','RAM_SIZE',N'8'),('HP-15S','RAM_TYPE',N'DDR4'),('HP-15S','RAM_SLOTS',N'2 khe (1 trống)'),('HP-15S','RAM_UPGRADABLE',N'Có'),('HP-15S','STORAGE',N'512GB NVMe'),('HP-15S','SSD_INTERFACE',N'M.2 NVMe'),('HP-15S','SCREEN',N'15.6'),('HP-15S','WEIGHT',N'1.69'),
 ('LENOVO-IDEA5','CPU',N'Intel Core i5-12450H'),('LENOVO-IDEA5','RAM_SIZE',N'16'),('LENOVO-IDEA5','RAM_TYPE',N'DDR5'),('LENOVO-IDEA5','RAM_SLOTS',N'Onboard (không nâng cấp)'),('LENOVO-IDEA5','RAM_UPGRADABLE',N'Không'),('LENOVO-IDEA5','STORAGE',N'512GB NVMe'),('LENOVO-IDEA5','SSD_INTERFACE',N'M.2 NVMe'),('LENOVO-IDEA5','SCREEN',N'14'),('LENOVO-IDEA5','WEIGHT',N'1.46'),
 ('MBA-M2','CPU',N'Apple M2 8 nhân'),('MBA-M2','RAM_SIZE',N'8'),('MBA-M2','RAM_UPGRADABLE',N'Không'),('MBA-M2','STORAGE',N'256GB SSD'),('MBA-M2','SCREEN',N'13.6'),('MBA-M2','WEIGHT',N'1.24'),
 ('ASUS-VIVO-PRO','CPU',N'AMD Ryzen 7 7735HS'),('ASUS-VIVO-PRO','GPU',N'NVIDIA RTX 3050 4GB'),('ASUS-VIVO-PRO','RAM_SIZE',N'16'),('ASUS-VIVO-PRO','RAM_TYPE',N'DDR5'),('ASUS-VIVO-PRO','RAM_SLOTS',N'2 khe (0 trống)'),('ASUS-VIVO-PRO','RAM_UPGRADABLE',N'Có'),('ASUS-VIVO-PRO','STORAGE',N'1TB NVMe'),('ASUS-VIVO-PRO','SSD_INTERFACE',N'M.2 NVMe'),('ASUS-VIVO-PRO','SCREEN',N'15.6 OLED'),('ASUS-VIVO-PRO','WEIGHT',N'1.8'),
 ('DELL-XPS-15','CPU',N'Intel Core i7-13700H'),('DELL-XPS-15','GPU',N'NVIDIA RTX 4050 6GB'),('DELL-XPS-15','RAM_SIZE',N'16'),('DELL-XPS-15','RAM_TYPE',N'DDR5'),('DELL-XPS-15','RAM_SLOTS',N'2 khe (0 trống)'),('DELL-XPS-15','RAM_UPGRADABLE',N'Có'),('DELL-XPS-15','STORAGE',N'512GB NVMe'),('DELL-XPS-15','SSD_INTERFACE',N'M.2 NVMe'),('DELL-XPS-15','SCREEN',N'15.6 OLED 3.5K'),('DELL-XPS-15','WEIGHT',N'1.86'),
 ('KVR-D4-8','RAM_SIZE',N'8'),('KVR-D4-8','RAM_TYPE',N'DDR4'),('KVR-D5-16','RAM_SIZE',N'16'),('KVR-D5-16','RAM_TYPE',N'DDR5'),('CRU-D5-8','RAM_SIZE',N'8'),('CRU-D5-8','RAM_TYPE',N'DDR5'),
 ('SAM-980-500','CAPACITY',N'500'),('SAM-980-500','SSD_INTERFACE',N'M.2 NVMe'),('SAM-980P-1TB','CAPACITY',N'1000'),('SAM-980P-1TB','SSD_INTERFACE',N'M.2 NVMe'),('KIN-A400-480','CAPACITY',N'480'),('KIN-A400-480','SSD_INTERFACE',N'SATA 2.5'),
 ('LOGI-G102','CONNECTION',N'Có dây'),('LOGI-G102','DPI',N'8000'),('LOGI-MXM3S','CONNECTION',N'Không dây'),('LOGI-MXM3S','DPI',N'8000'),('RAZER-DAV3','CONNECTION',N'Có dây'),('RAZER-DAV3','DPI',N'30000'),
 ('CORSAIR-K70','CONNECTION',N'Có dây'),('LOGI-K380','CONNECTION',N'Không dây'),('RAZER-BSV2X','CONNECTION',N'Có dây')
) v(sku,code,val)
JOIN dbo.Products p ON p.Sku = v.sku JOIN dbo.Attributes a ON a.AttrCode = v.code;

-- Luật tương thích: RAM phải cùng chuẩn RAM_TYPE, SSD phải cùng chuẩn SSD_INTERFACE với laptop (MainCategory có thể là danh mục cha)
-- LƯU Ý khi lọc gợi ý linh kiện tương thích (app code): ngoài khớp Attribute ở bảng này, với luật RAM còn phải
-- kiểm tra thêm ProductAttributeValues của laptop có RAM_UPGRADABLE = 'Có' (loại máy hàn RAM onboard, vd LENOVO-IDEA5,
-- MBA-M2 - vẫn có RAM_TYPE nhưng không thể nâng cấp) trước khi coi là tương thích/gợi ý mua thêm.
INSERT INTO dbo.CompatibilityRules (MainCategoryId, ComponentCategoryId, AttributeId, Description)
SELECT m.CategoryId, c.CategoryId, a.AttributeId, v.d FROM (VALUES
 ('laptop','ram','RAM_TYPE',N'RAM phải cùng chuẩn (DDR4/DDR5) với laptop VÀ laptop phải có RAM_UPGRADABLE = Có (loại máy RAM onboard không nâng cấp)'),
 ('laptop','ssd','SSD_INTERFACE',N'SSD phải cùng chuẩn giao tiếp (M.2 NVMe / SATA) với laptop')) v(m,c,a,d)
JOIN dbo.Categories m ON m.Slug = v.m JOIN dbo.Categories c ON c.Slug = v.c JOIN dbo.Attributes a ON a.AttrCode = v.a;

/* ---------- 4b. San pham bo sung (Laptop nhieu hang, nhieu tam gia - nguon GearVN/PhongVu) ---------- */
INSERT INTO dbo.Brands (BrandName, Country) VALUES (N'Acer', N'Dai Loan');

INSERT INTO dbo.Products (Sku, ProductName, Slug, CategoryId, BrandId, ShortDesc, CostPrice, SalePrice, WarrantyMonths, IsSerialTracked)
SELECT v.sku, v.n, v.slug, c.CategoryId, b.BrandId, v.sd, v.cost, v.price, v.war, v.ser
FROM (VALUES
 ('MSI-MODERN-14-C11M-011VN', N'MSI Modern 14 C11M-011VN', 'msi-modern-14-c11m-011vn', 'laptop-van-phong', N'MSI', N'Intel Core i3-1115G4, 8GB DDR4', 7860000, 9590000, 24, 1),
 ('MSI-MODERN-15-F1MG-1225VN', N'MSI Modern 15 F1MG-1225VN', 'msi-modern-15-f1mg-1225vn', 'laptop-van-phong', N'MSI', N'Intel Core 5-120U, 16GB', 18200000, 22190000, 24, 1),
 ('MSI-MODERN-14-H1M-014VN', N'MSI Modern 14 H1M-014VN', 'msi-modern-14-h1m-014vn', 'laptop-van-phong', N'MSI', N'Intel Core 7-150U, 16GB', 20900000, 25490000, 24, 1),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2', N'MSI Cyborg 15 Black Edition A13VEO-2610VN', 'msi-cyborg-15-black-edition-a13veo-2610vn', 'laptop-gaming', N'MSI', N'Intel Core i5-13420H, NVIDIA RTX 4050 6GB, 16GB', 26230000, 31990000, 24, 1),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1', N'MSI Cyborg 15 Black Edition A13VEO-2608VN', 'msi-cyborg-15-black-edition-a13veo-2608vn', 'laptop-gaming', N'MSI', N'Intel Core i7-13620H, NVIDIA RTX 4050 6GB, 16GB', 27870000, 33990000, 24, 1),
 ('MSI-CYBORG-15-C13WEO-418VN', N'MSI Cyborg 15 C13WEO-418VN', 'msi-cyborg-15-c13weo-418vn', 'laptop-gaming', N'MSI', N'Intel Core i5-13420H, NVIDIA RTX 5050 8GB, 16GB', 28690000, 34990000, 24, 1),
 ('MSI-MODERN-16S-G3MG-016VN', N'MSI Modern 16S G3MG-016VN', 'msi-modern-16s-g3mg-016vn', 'laptop-van-phong', N'MSI', N'Intel Core 7-350, 16GB', 27870000, 33990000, 24, 1),
 ('MSI-MODERN-16S-AI-G3MG-058VN', N'MSI Modern 16S AI+ G3MG-058VN', 'msi-modern-16s-ai-g3mg-058vn', 'laptop-do-hoa', N'MSI', N'Intel Core Ultra 7-355, 16GB', 36070000, 43990000, 24, 1),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN', N'MSI Prestige 14 AI+ D3MG-022VN', 'msi-prestige-14-ai-d3mg-022vn', 'laptop-do-hoa', N'MSI', N'Intel Core Ultra 7-355, 32GB', 36480000, 44490000, 24, 1),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN', N'MSI Prestige 13 AI+ Evo A2VMG-040VN', 'msi-prestige-13-ai-evo-a2vmg-040vn', 'laptop-do-hoa', N'MSI', N'Intel Core Ultra 7, 32GB', 31150000, 37990000, 24, 1),
 ('MSI-CYBORG-15-MAX-C13WE-422VN', N'MSI Cyborg 15 Max C13WE-422VN', 'msi-cyborg-15-max-c13we-422vn', 'laptop-gaming', N'MSI', N'Intel Core i7-13620H, NVIDIA RTX 5050 8GB, 16GB', 35250000, 42990000, 24, 1),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030', N'Lenovo IdeaPad 1 (Pentium Silver N5030)', 'lenovo-ideapad-1-pentium-silver-n5030', 'laptop-van-phong', N'Lenovo', N'Intel Pentium Silver N5030, 4GB', 6960000, 8490000, 24, 1),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV', N'Lenovo IdeaPad Slim 3 14IWC11 83RQ00DBVN', 'lenovo-ideapad-slim-3-14iwc11-83rq00dbvn', 'laptop-van-phong', N'Lenovo', N'Intel Core 3-304, 8GB', 20490000, 24990000, 24, 1),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV', N'Lenovo IdeaPad Slim 3 16AHP10 83KB005YVN', 'lenovo-ideapad-slim-3-16ahp10-83kb005yvn', 'laptop-van-phong', N'Lenovo', N'AMD Ryzen 5-125, 8GB', 21310000, 25990000, 24, 1),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V', N'Lenovo IdeaPad Slim 3 16AHP10 83KB0060VN', 'lenovo-ideapad-slim-3-16ahp10-83kb0060vn', 'laptop-van-phong', N'Lenovo', N'AMD Ryzen 7-155, 8GB', 22950000, 27990000, 24, 1),
 ('LEN-LOQ-15ARP10E-83S0006RVN', N'Lenovo LOQ 15ARP10E 83S0006RVN', 'lenovo-loq-15arp10e-83s0006rvn', 'laptop-gaming', N'Lenovo', N'AMD Ryzen 7-7735HS, NVIDIA RTX 3050 6GB, 16GB', 25410000, 30990000, 24, 1),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX', N'Lenovo IdeaPad Slim 5 14AKP10 OLED 83HX00ABVN', 'lenovo-ideapad-slim-5-14akp10-oled-83hx00abvn', 'laptop-do-hoa', N'Lenovo', N'AMD Ryzen AI 5-330, 16GB', 25410000, 30990000, 24, 1),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1', N'Lenovo IdeaPad Slim 5 14AGP11 OLED 83S1006RVN', 'lenovo-ideapad-slim-5-14agp11-oled-83s1006rvn', 'laptop-do-hoa', N'Lenovo', N'AMD Ryzen AI 7-445, 16GB', 27050000, 32990000, 24, 1),
 ('LEN-LOQ-15IRX10-83JE01AGVN', N'Lenovo LOQ 15IRX10 83JE01AGVN', 'lenovo-loq-15irx10-83je01agvn', 'laptop-gaming', N'Lenovo', N'Intel Core i7-13645HX, NVIDIA RTX 5050 8GB, 16GB', 31150000, 37990000, 24, 1),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007', N'Lenovo Yoga Slim 7 14IPH11 OLED 83QM0076VN', 'lenovo-yoga-slim-7-14iph11-oled-83qm0076vn', 'laptop-do-hoa', N'Lenovo', N'Intel Core Ultra 7-355, 16GB', 38530000, 46990000, 24, 1),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN', N'Lenovo Legion 5 15IAX11 83VK00A3VN', 'lenovo-legion-5-15iax11-83vk00a3vn', 'laptop-gaming', N'Lenovo', N'Intel Core Ultra 7-251HX, NVIDIA RTX 5060, 24GB', 54930000, 66990000, 24, 1),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN', N'Lenovo Legion Pro 7 16IAX10H 83F500JGVN', 'lenovo-legion-pro-7-16iax10h-83f500jgvn', 'laptop-gaming', N'Lenovo', N'Intel Core Ultra 9-275HX, NVIDIA RTX 5070 Ti, 32GB', 95110000, 115990000, 24, 1),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD', N'Dell 15 Pro Essential PV15250 VKVKD (i3-100U)', 'dell-15-pro-essential-pv15250-vkvkd-i3-100u', 'laptop-van-phong', N'Dell', N'Intel Core 3-100U, 8GB DDR5', 11800000, 14390000, 24, 1),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1', N'Dell 15 Pro Essential PV15250 VKVKD (i5-1334U)', 'dell-15-pro-essential-pv15250-vkvkd-i5-1334u', 'laptop-van-phong', N'Dell', N'Intel Core i5-1334U, 8GB', 13110000, 15990000, 24, 1),
 ('DELL-16-DC16251-I5-120U', N'Dell 16 DC16251 (i5-120U)', 'dell-16-dc16251-i5-120u', 'laptop-van-phong', N'Dell', N'Intel Core i5-120U, 8GB', 15080000, 18390000, 24, 1),
 ('DELL-DC15250-7982BLK-H5YXJ', N'Dell DC15250-7982BLK H5YXJ', 'dell-dc15250-7982blk-h5yxj', 'laptop-van-phong', N'Dell', N'Intel Core i7-1355U, 16GB', 18850000, 22990000, 24, 1),
 ('DELL-15-DC15255-X9YM41', N'Dell 15 DC15255 X9YM41', 'dell-15-dc15255-x9ym41', 'laptop-van-phong', N'Dell', N'AMD Ryzen 7 7730U, 16GB', 18850000, 22990000, 24, 1),
 ('DELL-INSPIRON-5441-5MNK1', N'Dell Inspiron 5441 5MNK1', 'dell-inspiron-5441-5mnk1', 'laptop-van-phong', N'Dell', N'Qualcomm Snapdragon X1P, 16GB', 20490000, 24990000, 24, 1),
 ('DELL-15-DC15250-CPH991', N'Dell 15 DC15250-CPH991', 'dell-15-dc15250-cph991', 'laptop-van-phong', N'Dell', N'Intel Core i7-1355U, 16GB', 21310000, 25990000, 24, 1),
 ('DELL-14-DC14250-F0FTK5', N'Dell 14 DC14250 F0FTK5', 'dell-14-dc14250-f0ftk5', 'laptop-van-phong', N'Dell', N'Intel Core 5-120U, 16GB', 21720000, 26490000, 24, 1),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1', N'Dell Pro 14 Essential PV14250-120U-16512W', 'dell-pro-14-essential-pv14250-120u-16512w', 'laptop-van-phong', N'Dell', N'Intel Core 5-120U, 16GB', 21310000, 25990000, 24, 1),
 ('DELL-16-DC16251-DC6C7557W1', N'Dell 16 DC16251 DC6C7557W1', 'dell-16-dc16251-dc6c7557w1', 'laptop-do-hoa', N'Dell', N'Intel Core 7-150U, NVIDIA MX570A, 16GB', 26230000, 31990000, 24, 1),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W', N'Dell Pro 14 Plus PB14250-235U-16512W', 'dell-pro-14-plus-pb14250-235u-16512w', 'laptop-van-phong', N'Dell', N'Intel Core Ultra 5-235U vPro, 16GB', 28940000, 35290000, 24, 1),
 ('DELL-16-PLUS-DB16250-X65NW7', N'Dell 16 Plus DB16250 X65NW7', 'dell-16-plus-db16250-x65nw7', 'laptop-do-hoa', N'Dell', N'Intel Core Ultra 7-256V, 16GB', 32790000, 39990000, 24, 1),
 ('DELL-XPS-13-DX13260-DX3C5376W1', N'Dell XPS 13 DX13260 DX3C5376W1', 'dell-xps-13-dx13260-dx3c5376w1', 'laptop-do-hoa', N'Dell', N'Intel Core 5-320, 16GB', 37960000, 46290000, 24, 1),
 ('ASUS-D515DA-EJ845T', N'Asus D515DA EJ845T', 'asus-d515da-ej845t', 'laptop-van-phong', N'Asus', N'AMD Ryzen 3-3250U, 4GB DDR4', 7950000, 9690000, 24, 1),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50', N'Asus ExpertBook P1 P1403CVA-C3U08-50W', 'asus-expertbook-p1-p1403cva-c3u08-50w', 'laptop-van-phong', N'Asus', N'Intel Core 3-100U, 8GB', 12700000, 15490000, 24, 1),
 ('ASUS-VIVOBOOK-14-X1404V', N'Asus Vivobook 14 X1404V', 'asus-vivobook-14-x1404v', 'laptop-van-phong', N'Asus', N'Intel Core 5-120U, 8GB', 13600000, 16590000, 24, 1),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W', N'Asus ExpertBook P1403CVA-C5H08-50W', 'asus-expertbook-p1403cva-c5h08-50w', 'laptop-van-phong', N'Asus', N'Intel Core 5-210H, 8GB', 15980000, 19490000, 24, 1),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W', N'Asus ExpertBook B1 BM1403CDA S61611W', 'asus-expertbook-b1-bm1403cda-s61611w', 'laptop-van-phong', N'Asus', N'AMD Ryzen 5-150, 16GB', 16390000, 19990000, 24, 1),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W', N'Asus ExpertBook P1403CVA-C5H16-50W', 'asus-expertbook-p1403cva-c5h16-50w', 'laptop-van-phong', N'Asus', N'Intel Core 5-210H, 16GB', 19180000, 23390000, 24, 1),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W', N'Asus ExpertBook P1503CVA-S72922W', 'asus-expertbook-p1503cva-s72922w', 'laptop-van-phong', N'Asus', N'Intel Core 5-210H, 16GB', 18850000, 22990000, 24, 1),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W', N'Asus Vivobook 14 X1404VA-EB355W', 'asus-vivobook-14-x1404va-eb355w', 'laptop-van-phong', N'Asus', N'Intel Core 7-150U, 16GB', 18850000, 22990000, 24, 1),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W', N'Asus Vivobook Go 14 E1404FA-EB935W', 'asus-vivobook-go-14-e1404fa-eb935w', 'laptop-van-phong', N'Asus', N'AMD Ryzen 5-40, 16GB', 17460000, 21290000, 24, 1),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W', N'Asus TUF Gaming A15 FA506NCG-HN329W', 'asus-tuf-gaming-a15-fa506ncg-hn329w', 'laptop-gaming', N'Asus', N'AMD Ryzen 7 8845HS, NVIDIA RTX 3050, 16GB', 23770000, 28990000, 24, 1),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516', N'Asus ExpertBook P3 G1 P3406CCAP-U516S8W', 'asus-expertbook-p3-g1-p3406ccap-u516s8w', 'laptop-van-phong', N'Asus', N'Intel Core Ultra 5-225H, 16GB', 22950000, 27990000, 24, 1),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W', N'Asus Zenbook 14 UX3405CA-ST1713W', 'asus-zenbook-14-ux3405ca-st1713w', 'laptop-do-hoa', N'Asus', N'Intel Core Ultra 5-225H, 16GB', 25410000, 30990000, 24, 1),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W', N'Asus ExpertBook P3 P3406CCAP-U716W', 'asus-expertbook-p3-p3406ccap-u716w', 'laptop-van-phong', N'Asus', N'Intel Core Ultra 7-255H, 16GB', 27050000, 32990000, 24, 1),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W', N'Asus Zenbook S 14 UX5406AA-SU348W', 'asus-zenbook-s-14-ux5406aa-su348w', 'laptop-do-hoa', N'Asus', N'Intel Core Ultra 9, 16GB', 41810000, 50990000, 24, 1),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W', N'Asus ROG Zephyrus G14 GA403GM-SY201W', 'asus-rog-zephyrus-g14-ga403gm-sy201w', 'laptop-gaming', N'Asus', N'AMD Ryzen AI 9 365, NVIDIA RTX 5060, 32GB', 61490000, 74990000, 24, 1),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305', N'Acer Aspire Lite 14 AL14 (2025, N305)', 'acer-aspire-lite-14-al14-2025-n305', 'laptop-van-phong', N'Acer', N'Intel Core i3-N305, 8GB LPDDR5', 6960000, 8490000, 24, 1),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8', N'Acer Aspire Lite 15 AL15-410P-R1W8', 'acer-aspire-lite-15-al15-410p-r1w8', 'laptop-van-phong', N'Acer', N'AMD Ryzen 5-3500U, 8GB', 14670000, 17890000, 24, 1),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR', N'Acer Aspire Lite 14 AL14-47P-R0TR', 'acer-aspire-lite-14-al14-47p-r0tr', 'laptop-van-phong', N'Acer', N'AMD Ryzen 5-3500U, 8GB', 14750000, 17990000, 24, 1),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH', N'Acer Aspire Lite 15 AL15-53P-56QH', 'acer-aspire-lite-15-al15-53p-56qh', 'laptop-van-phong', N'Acer', N'Intel Core 5-120U, 8GB', 15490000, 18890000, 24, 1),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8', N'Acer Aspire Lite 14 AL14-53M-53E8', 'acer-aspire-lite-14-al14-53m-53e8', 'laptop-van-phong', N'Acer', N'Intel Core 5-120U, 16GB', 17870000, 21790000, 24, 1),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J', N'Acer Aspire Go 15 AG15-72P-776J', 'acer-aspire-go-15-ag15-72p-776j', 'laptop-van-phong', N'Acer', N'Intel Core 7-150U, 16GB', 18850000, 22990000, 24, 1),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV', N'Acer Swift Air 14 SFA14-I31-52BV', 'acer-swift-air-14-sfa14-i31-52bv', 'laptop-van-phong', N'Acer', N'Intel Core 5-320, 12GB', 20490000, 24990000, 24, 1),
 ('ACER-ASPIRE-7-A715-59G-59RD', N'Acer Aspire 7 A715-59G-59RD', 'acer-aspire-7-a715-59g-59rd', 'laptop-gaming', N'Acer', N'Intel Core 5-210H, NVIDIA RTX 3050 4GB, 16GB', 21310000, 25990000, 24, 1),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA', N'Acer Nitro ProPanel ANV15-52-50VA', 'acer-nitro-propanel-anv15-52-50va', 'laptop-gaming', N'Acer', N'Intel Core 5-210H, NVIDIA RTX 3050, 16GB', 24350000, 29690000, 24, 1),
 ('ACER-ASPIRE-7-A715-59G-53RH', N'Acer Aspire 7 A715-59G-53RH', 'acer-aspire-7-a715-59g-53rh', 'laptop-gaming', N'Acer', N'Intel Core 5-210H, NVIDIA RTX 4050 6GB, 16GB', 24430000, 29790000, 24, 1),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF', N'Acer Nitro ProPanel ANV15-42-R5EF', 'acer-nitro-propanel-anv15-42-r5ef', 'laptop-gaming', N'Acer', N'AMD Ryzen 5 7640HS, NVIDIA RTX 4050 6GB, 16GB', 27380000, 33390000, 24, 1),
 ('ACER-SWIFT-X-SFX14-71G-78SY', N'Acer Swift X SFX14-71G-78SY', 'acer-swift-x-sfx14-71g-78sy', 'laptop-do-hoa', N'Acer', N'Intel Core i7-13700H, NVIDIA RTX 4050 6GB, 32GB', 29510000, 35990000, 24, 1),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M', N'Acer Swift Go AI OLED SFG14-75-765M', 'acer-swift-go-ai-oled-sfg14-75-765m', 'laptop-do-hoa', N'Acer', N'Intel Core Ultra 7-258V, 32GB', 32790000, 39990000, 24, 1),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9', N'Acer Nitro ProPanel ANV16-72-71T9', 'acer-nitro-propanel-anv16-72-71t9', 'laptop-gaming', N'Acer', N'Intel Core 7-240H, NVIDIA RTX 5060, 16GB', 36890000, 44990000, 24, 1),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71', N'Acer Predator Helios 18 AI PH18-I71-91UX', 'acer-predator-helios-18-ai-ph18-i71-91ux', 'laptop-gaming', N'Acer', N'Intel Core Ultra 9-290HX Plus, NVIDIA RTX 5080 16GB, 64GB', 147590000, 179990000, 24, 1)
) v(sku,n,slug,cat,brand,sd,cost,price,war,ser)
JOIN dbo.Categories c ON c.Slug = v.cat
JOIN dbo.Brands b ON b.BrandName = v.brand;

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, IsPrimary, SortOrder)
SELECT p.ProductId, v.img, v.isp, v.ord FROM (VALUES
 ('MSI-MODERN-14-C11M-011VN','https://hanoicomputercdn.com/media/product/70403_laptop_msi_modern_14_14.png',1,0),
 ('MSI-MODERN-14-C11M-011VN','https://hanoicomputercdn.com/media/product/70403_laptop_msi_modern_14_11.png',0,1),
 ('MSI-MODERN-14-C11M-011VN','https://hanoicomputercdn.com/media/product/70403_laptop_msi_modern_14_12.png',0,2),
 ('MSI-MODERN-15-F1MG-1225VN','https://cdn.mediamart.vn/images/product/laptop-msi-modern-15-f1mg-1225vn-core-5-120u16gb512gb156fhd-3cw11hslkb2ytui_e2adfe43.webp',1,0),
 ('MSI-MODERN-15-F1MG-1225VN','https://cdn.mediamart.vn/images/product/laptop-msi-modern-15-f1mg-1225vn-core-5-120u16gb512gb156fhd-3cw11hslkb2ytui_43508a81.webp',0,1),
 ('MSI-MODERN-15-F1MG-1225VN','https://cdn.mediamart.vn/images/product/laptop-msi-modern-15-f1mg-1225vn-core-5-120u16gb512gb156fhd-3cw11hslkb2ytui_d7bbde45.webp',0,2),
 ('MSI-MODERN-14-H1M-014VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_modern_14_h1m-014vn_-_1.png',1,0),
 ('MSI-MODERN-14-H1M-014VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_modern_14_h1m-014vn_-_2.png',0,1),
 ('MSI-MODERN-14-H1M-014VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_modern_14_h1m-014vn_-_3.png',0,2),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_black_edition_a13veo-2610vn_-_1.png',1,0),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_black_edition_a13veo-2610vn_-_3.png',0,1),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','https://cdn2.cellphones.com.vn/x/media/catalog/product/x/_/x_m_2_211_1.png',0,2),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_black_edition_a13veo-2608vn_-_1.png',1,0),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_black_edition_a13veo-2608vn_-_2.png',0,1),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_black_edition_a13veo-2608vn_-_3.png',0,2),
 ('MSI-CYBORG-15-C13WEO-418VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_c13weo-418vn_-_1_1.png',1,0),
 ('MSI-CYBORG-15-C13WEO-418VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_c13weo-418vn_-_2.png',0,1),
 ('MSI-CYBORG-15-C13WEO-418VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_c13weo-418vn_-_3_1.png',0,2),
 ('MSI-MODERN-16S-G3MG-016VN','https://bizweb.dktcdn.net/thumb/grande/100/329/122/products/laptop-msi-modern-16s-g3mg-016vn-01.jpg?v=1778841015610',1,0),
 ('MSI-MODERN-16S-G3MG-016VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-modern-16s-g3mg-016vn-02.jpg?v=1778841016787',0,1),
 ('MSI-MODERN-16S-G3MG-016VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-modern-16s-g3mg-016vn-03.jpg?v=1778841018100',0,2),
 ('MSI-MODERN-16S-AI-G3MG-058VN','https://bizweb.dktcdn.net/thumb/grande/100/329/122/products/laptop-msi-modern-16s-ai-plus-g3mg-058vn-01.jpg?v=1778836391540',1,0),
 ('MSI-MODERN-16S-AI-G3MG-058VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-modern-16s-ai-plus-g3mg-058vn-02.jpg?v=1778836391540',0,1),
 ('MSI-MODERN-16S-AI-G3MG-058VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-modern-16s-ai-plus-g3mg-058vn-03.jpg?v=1778836391540',0,2),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_prestige_14_ai_d3mg-022vn_-_1.png',1,0),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_prestige_14_ai_d3mg-022vn_-_2.png',0,1),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_prestige_14_ai_d3mg-022vn_-_3.png',0,2),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','https://bizweb.dktcdn.net/thumb/grande/100/329/122/products/laptop-msi-prestige-13-ai-evo-a2vmg-040vn-1.jpg?v=1764143923703',1,0),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-prestige-13-ai-plus-evo-a2vmg-040vn-04.jpg?v=1764143923703',0,1),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','https://bizweb.dktcdn.net/thumb/1024x1024/100/329/122/products/laptop-msi-prestige-13-ai-plus-evo-a2vmg-040vn-03.jpg?v=1764143923703',0,2),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_max_c13we-422vn_-_1.png',1,0),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_max_c13we-422vn_-_2.png',0,1),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_msi_cyborg_15_max_c13we-422vn_-_3.png',0,2),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','https://cdn.tgdd.vn/Products/Images/44/274463/Slider/vi-vn-lenovo-ideapad-1-11igl05-n5030-81vt006fvn-1.jpg',1,0),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','https://cdn.tgdd.vn/Products/Images/44/274463/Slider/vi-vn-lenovo-ideapad-1-11igl05-n5030-81vt006fvn-2.jpg',0,1),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','https://cdn.tgdd.vn/Products/Images/44/274463/lenovo-ideapad-1-11igl05-n5030-81vt006fvn-1-1.jpg',0,2),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/00929656_lenovo_ideapad_slim_3_14iwc11_01_5761ae26b4.png',1,0),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/00929656_lenovo_ideapad_slim_3_14iwc11_02_02898f6ddf.png',0,1),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/368208/lenovo-ideapad-slim-3-14iwc11-core-5-320-83rq002pvn-1-639172174446645951.jpg',0,2),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','https://m6hyxhcitg.execute-api.eu-central-1.amazonaws.com/prod/storage/app/uploads/public/689/481/11b/68948111b8d64163150821.jpg',1,0),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','https://m6hyxhcitg.execute-api.eu-central-1.amazonaws.com/prod/storage/app/media/uploaded-files/04_IdeaPad_Slim_3_16_10_luna_grey_yesMetalNobadge_3Q_open_front_facing_right.jpg',0,1),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','https://www.jib.co.th/img_master/product/original/20260127152840_82975_287_1.jpg',0,2),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','https://m6hyxhcitg.execute-api.eu-central-1.amazonaws.com/prod/storage/app/uploads/public/681/47d/a2d/68147da2da426050524026.jpg',1,0),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','https://www.jib.co.th/img_master/product/icon/20260127152842_82975_287_2.jpg',0,1),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','https://www.jib.co.th/img_master/product/icon/20260127152844_82975_287_3.jpg',0,2),
 ('LEN-LOQ-15ARP10E-83S0006RVN','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/lenovo_gaming_loq_15arp10e_xam_01_9030b306bc.png',1,0),
 ('LEN-LOQ-15ARP10E-83S0006RVN','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/lenovo_gaming_loq_15arp10e_r7_7735hs_83s0006qvn_1_0c8f255aee.jpg',0,1),
 ('LEN-LOQ-15ARP10E-83S0006RVN','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/lenovo_gaming_loq_15arp10e_r7_7735hs_83s0006qvn_4_c44d7a5985.jpg',0,2),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_ideapad_slim_5_14akp10_83hx00abvn_-_1.png',1,0),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_ideapad_slim_5_14akp10_83hx00abvn_-_2.png',0,1),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/lenovo_ideapad_slim_5_14akp10_06_60b7ac1487.png',0,2),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_ideapad_slim_5_14agp11_83s1006rvn_-_1.png',1,0),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_ideapad_slim_5_14agp11_83s1006rvn_-_2.png',0,1),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_ideapad_slim_5_14agp11_83s1006rvn_-_3.png',0,2),
 ('LEN-LOQ-15IRX10-83JE01AGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_loq_15irx10_83je01agvn_-_1.png',1,0),
 ('LEN-LOQ-15IRX10-83JE01AGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_loq_15irx10_83je01agvn_-_2.png',0,1),
 ('LEN-LOQ-15IRX10-83JE01AGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_loq_15irx10_83je01agvn_-_3.png',0,2),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_yoga_slim_7_14iph11_83qm0076vn_-_1.png',1,0),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_yoga_slim_7_14iph11_83qm0076vn_-_2.png',0,1),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_yoga_slim_7_14iph11_83qm0076vn_-_3.png',0,2),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/6/b/6b62ad50-1ebf-4e6b-bf62-566a7c9a35a5.png',1,0),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/e/0/e08c97dc-f724-491d-9204-cb4c25127c57.png',0,1),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','https://cdn2.cellphones.com.vn/x/media/catalog/product/c/e/ced656dc-51fa-4ddc-9c77-99d5ce2eaaac.png',0,2),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_legion_pro_7_16iax10h_83f500jgvn_-_1.png',1,0),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_legion_pro_7_16iax10h_83f500jgvn_-_3.png',0,1),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_lenovo_legion_pro_7_16iax10h_83f500jgvn_-_2.png',0,2),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/dell_pro_15_essential_pv15250_black_01_8e7f61f275.png',1,0),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/Dell_Pro_15_Essential_PV_15250_1_2a0eff14db.png',0,1),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/Dell_Pro_15_Essential_PV_15250_2_af8851d954.png',0,2),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/Dell_Pro_15_Essential_PV_15250_3_c614a02477.png',1,0),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/Dell_Pro_15_Essential_PV_15250_4_64a9e5af6e.png',0,1),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/dell_pro_15_essential_pv15250_black_02_7120b39e41.png',0,2),
 ('DELL-16-DC16251-I5-120U','https://cdn-files.hacom.vn/hacom/cdn/web/04062026/Laptop-Dell-16-DC16251-P131F001-Core-5-120U16GB-DDR5512GB-SSD16-inch-FHDCam-ungWin11Bac-NK_Bao-hanh-tai-HACOM-2.jpg',1,0),
 ('DELL-16-DC16251-I5-120U','https://cdn-files.hacom.vn/hacom/cdn/web/04062026/Laptop-Dell-16-DC16251-P131F001-Core-5-120U16GB-DDR5512GB-SSD16-inch-FHDCam-ungWin11Bac-NK_Bao-hanh-tai-HACOM-1.jpg',0,1),
 ('DELL-16-DC16251-I5-120U','https://cdn-files.hacom.vn/hacom/cdn/web/04062026/Laptop-Dell-16-DC16251-P131F001-Core-5-120U16GB-DDR5512GB-SSD16-inch-FHDCam-ungWin11Bac-NK_Bao-hanh-tai-HACOM-3.jpg',0,2),
 ('DELL-DC15250-7982BLK-H5YXJ','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15250_h5yxj_-_1.png',1,0),
 ('DELL-DC15250-7982BLK-H5YXJ','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15250_h5yxj_-_2.png',0,1),
 ('DELL-DC15250-7982BLK-H5YXJ','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15250_h5yxj_-_3.png',0,2),
 ('DELL-15-DC15255-X9YM41','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15255_x9ym41_-_1.png',1,0),
 ('DELL-15-DC15255-X9YM41','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15255_x9ym41_-_2.png',0,1),
 ('DELL-15-DC15255-X9YM41','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_dell_15_dc15255_x9ym41_-_3.png',0,2),
 ('DELL-INSPIRON-5441-5MNK1','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/dell_inspiron_14_5441_x1p_64_100_5mnk1_1_fbddaef1f7.jpg',1,0),
 ('DELL-INSPIRON-5441-5MNK1','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/dell_inspiron_14_5441_x1p_64_100_5mnk1_2_78056fb505.jpg',0,1),
 ('DELL-15-DC15250-CPH991','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362020/dell-15-dc15250-i7-1355u-cph991-1-639044156610018550.jpg',1,0),
 ('DELL-15-DC15250-CPH991','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362020/dell-15-dc15250-i7-1355u-cph991-2-639044156603261765.jpg',0,1),
 ('DELL-15-DC15250-CPH991','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362020/dell-15-dc15250-i7-1355u-cph991-3-639044156595315431.jpg',0,2),
 ('DELL-14-DC14250-F0FTK5','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/Dell_14_DC_14250_Bac_01_11c0a90f25.png',1,0),
 ('DELL-14-DC14250-F0FTK5','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/dell_14_dc14250_core_5_120u_dc4c5386w_1_ce1f1d808f.jpg',0,1),
 ('DELL-14-DC14250-F0FTK5','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/dell_14_dc14250_core_5_120u_dc4c5386w_2_6dfe52ca6f.jpg',0,2),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362024/dell-pro-14-essential-pv14250-core-5-120u-pv14250-120u-16512w-bl-1-639046714940139388.jpg',1,0),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362024/dell-pro-14-essential-pv14250-core-5-120u-pv14250-120u-16512w-bl-2-639046714934249287.jpg',0,1),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/362024/dell-pro-14-essential-pv14250-core-5-120u-pv14250-120u-16512w-bl-3-639046714952828333.jpg',0,2),
 ('DELL-16-DC16251-DC6C7557W1','https://cdn.tgdd.vn/Products/Images/44/362023/Slider/vi-vn-dell-16-dc16251-core-7-150u-dc6c7557w1-1.jpg',1,0),
 ('DELL-16-DC16251-DC6C7557W1','https://cdn.tgdd.vn/Products/Images/44/362023/Slider/vi-vn-dell-16-dc16251-core-7-150u-dc6c7557w1-2.jpg',0,1),
 ('DELL-16-DC16251-DC6C7557W1','https://cdn.tgdd.vn/Products/Images/44/362023/Slider/vi-vn-dell-16-dc16251-core-7-150u-dc6c7557w1-3.jpg',0,2),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','https://cdn.tgdd.vn/Products/Images/44/360697/Slider/vi-vn-dell-pro-14-plus-pb14250-ultra-5-235u-pb14250-235u-16512w-slider-1.jpg',1,0),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','https://cdn.tgdd.vn/Products/Images/44/360697/Slider/vi-vn-dell-pro-14-plus-pb14250-ultra-5-235u-pb14250-235u-16512w-slider-2.jpg',0,1),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','https://cdn.tgdd.vn/Products/Images/44/360697/Slider/vi-vn-dell-pro-14-plus-pb14250-ultra-5-235u-pb14250-235u-16512w-slider-3.jpg',0,2),
 ('DELL-16-PLUS-DB16250-X65NW7','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/dell_16_plus_db16250_xanh_01_d83ab94908.png',1,0),
 ('DELL-16-PLUS-DB16250-X65NW7','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/dell_16_plus_db16250_xanh_02_3d74f7773c.png',0,1),
 ('DELL-16-PLUS-DB16250-X65NW7','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/dell_16_plus_db16250_xanh_03_618515aba9.png',0,2),
 ('DELL-XPS-13-DX13260-DX3C5376W1','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-13-dx13260/media-gallery/sky/laptop-xps-13-sky-dx13260-silver-gallery-1.psd?fmt=png-alpha&pscan=auto&scl=1&hei=402&wid=522&qlt=100,0&resMode=sharp2&size=522,402',1,0),
 ('DELL-XPS-13-DX13260-DX3C5376W1','https://cdn2.cellphones.com.vn/x/media/catalog/product/f/e/fe5be9e1-1d8f-4e1e-ba1e-8ebfc7fe389f.jpg',0,1),
 ('DELL-XPS-13-DX13260-DX3C5376W1','https://cdn2.cellphones.com.vn/x/media/catalog/product/c/9/c9c06960-6cfb-421a-98ce-15394a27e96b.jpg',0,2),
 ('ASUS-D515DA-EJ845T','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/2021_3_3_637503832634786560_asus-vivobook-x515-print-bac-1.jpg',1,0),
 ('ASUS-D515DA-EJ845T','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/2021_3_3_637503832634319820_asus-vivobook-x515-print-bac-4.jpg',0,1),
 ('ASUS-D515DA-EJ845T','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/2021_3_3_637503832634630358_asus-vivobook-x515-print-bac-3.jpg',0,2),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','https://phucanhcdn.com/media/product/62206_laptop_asus_expertbook_p1403cva_c3u08_50w_1.jpg',1,0),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','https://phucanhcdn.com/media/product/62206_laptop_asus_expertbook_p1403cva_c3u08_50w_2.jpg',0,1),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','https://phucanhcdn.com/media/product/62206_laptop_asus_expertbook_p1403cva_c3u08_50w_3.jpg',0,2),
 ('ASUS-VIVOBOOK-14-X1404V','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_vivobook_x1404va_nk394w_i3_1315u_1_6bb6e2a348.jpg',1,0),
 ('ASUS-VIVOBOOK-14-X1404V','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_vivobook_x1404va_nk394w_i3_1315u_2_1d22cf0074.jpg',0,1),
 ('ASUS-VIVOBOOK-14-X1404V','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_vivobook_x1404va_nk394w_i3_1315u_3_4035ce7c7a.jpg',0,2),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','https://phucanhcdn.com/media/product/61667_laptop_asus_expertbook_p1403cva_1.jpg',1,0),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','https://phucanhcdn.com/media/product/61667_laptop_asus_expertbook_p1403cva_2.jpg',0,1),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','https://phucanhcdn.com/media/product/61667_laptop_asus_expertbook_p1403cva_3.jpg',0,2),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','https://cdn-files.hacom.vn/hacom/cdn/web/22062026/Laptop-Asus-Expertbook-BM1403CDA-S61611W-R5-15016GB-RAM-D5512GB-SSD14-WQXGAW11H-Xam-5.jpg',1,0),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8yMjA2MjAyNi9MYXB0b3AtQXN1cy1FeHBlcnRib29rLUJNMTQwM0NEQS1TNjE2MTFXLVI1LTE1MDE2R0ItUkFNLUQ1NTEyR0ItU1NEMTQtV1FYR0FXMTFILVhhbS0xLmpwZw.webp',0,1),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8yMjA2MjAyNi9MYXB0b3AtQXN1cy1FeHBlcnRib29rLUJNMTQwM0NEQS1TNjE2MTFXLVI1LTE1MDE2R0ItUkFNLUQ1NTEyR0ItU1NEMTQtV1FYR0FXMTFILVhhbS0yLmpwZw.webp',0,2),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','https://phucanhcdn.com/media/product/61668_laptop_asus_expertbook_p1403cva_1.jpg',1,0),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','https://phucanhcdn.com/media/product/61668_laptop_asus_expertbook_p1403cva_2.jpg',0,1),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','https://phucanhcdn.com/media/product/61668_laptop_asus_expertbook_p1403cva_3.jpg',0,2),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_expertbook_p1503cva_c5h16_63ws_core_5_210h_1_d7fae210c4.jpg',1,0),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_expertbook_p1503cva_c5h16_63ws_core_5_210h_2_ae38b5f6f4.jpg',0,1),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_expertbook_p1503cva_c5h16_63ws_core_5_210h_4_4ddde6d380.jpg',0,2),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_asus_vivobook_14_x1404va-eb355w_-_1.png',1,0),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_asus_vivobook_14_x1404va-eb355w_-_2.png',0,1),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_asus_vivobook_14_x1404va-eb355w_-_3.png',0,2),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','https://cdn2.fptshop.com.vn/unsafe/asus_vivobook_go_14_e1404fa_eb935w_1_0ac0820163.jpg',1,0),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','https://cdn2.fptshop.com.vn/unsafe/asus_vivobook_go_14_e1404fa_eb935w_2_feece27a3c.jpg',0,1),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','https://cdn2.fptshop.com.vn/unsafe/asus_vivobook_go_14_e1404fa_eb935w_3_df1dd948e9.jpg',0,2),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_tuf_gaming_a15_fa506ncg_hn329w_r7_8845hs_1_2a2d0ed48e.png',1,0),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_tuf_gaming_a15_fa506ncg_hn329w_r7_8845hs_2_e4cf7adaa6.png',0,1),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_tuf_gaming_a15_fa506ncg_hn329w_r7_8845hs_3_0dd97990ec.png',0,2),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','https://cdn-files.hacom.vn/hacom/cdn/web/11092026/Laptop-ASUS-ExpertBook-P3406CCAP-U516S8W-Ultra-5-225H16GB-D5512GB-SSDFingerPrint14-IPS-WUXGAW11H-McAfee-1-yearXam-1.jpg',1,0),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','https://cdn-files.hacom.vn/hacom/cdn/web/11092026/Laptop-ASUS-ExpertBook-P3406CCAP-U516S8W-Ultra-5-225H16GB-D5512GB-SSDFingerPrint14-IPS-WUXGAW11H-McAfee-1-yearXam-2.jpg',0,1),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','https://cdn-files.hacom.vn/hacom/cdn/web/11092026/Laptop-ASUS-ExpertBook-P3406CCAP-U516S8W-Ultra-5-225H16GB-D5512GB-SSDFingerPrint14-IPS-WUXGAW11H-McAfee-1-yearXam-3.jpg',0,2),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/zenbook_14_ux3405ca_st1713w_ultra_5_225h_1_e10cad2449.png',1,0),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/zenbook_14_ux3405ca_st1713w_ultra_5_225h_3_dda8a56aae.png',0,1),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/zenbook_14_ux3405ca_st1713w_ultra_5_225h_4_d93ec68b9f.png',0,2),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','https://phucanhcdn.com/media/product/64339_laptop_asus_expertbook_p3406.jpg',1,0),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','https://phucanhcdn.com/media/product/64339_laptop_asus_expertbook_p3406__2_.jpg',0,1),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','https://phucanhcdn.com/media/product/64339_laptop_asus_expertbook_p3406__3_.jpg',0,2),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_zenbook_s14_ux5406aa_su348w_ultra_9_386h_1_b334782af4.png',1,0),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_zenbook_s14_ux5406aa_su348w_ultra_9_386h_3_3dcb6250bd.png',0,1),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/asus_zenbook_s14_ux5406aa_su348w_ultra_9_386h_4_4c3625bb61.png',0,2),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','https://dlcdnwebimgs.asus.com/gain/87DCDC3E-F5C1-4195-915A-3251D2AB06A1/w1000/h732',1,0),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','https://dlcdnwebimgs.asus.com/gain/784B56CA-673B-4DF7-9F1F-8E5B0550D16F/w1000/h732',0,1),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','https://dlcdnwebimgs.asus.com/gain/6D242E91-1127-4073-A046-2692DB8CA2D4/w1000/h732',0,2),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_lite_14_al14_52p_silver_01_738d57049b.png',1,0),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_lite_14_al14_52p_silver_02_cf8280d03d.png',0,1),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','https://cdn2.fptshop.com.vn/unsafe/800x0/acer_aspire_lite_14_al14_52p_309t_1_2f306b35c4.jpg',0,2),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/00931261_acer_aspire_lite_15_al15_410p_xam_01_4429d702ef.png',1,0),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_lite_15_al15_410p_r1w8_r5_3500u_1_6ad685f850.png',0,1),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','https://cdn-files.hacom.vn/hacom/cdn/web/21092026/v-1.jpg',0,2),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/00931262_acer_aspire_lite_14_al14_47p_xam_01_177081f228.png',1,0),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_lite_14_al14_47p_r0tr_4_a5bb85b3e0.png',0,1),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','https://cdn-files.hacom.vn/hacom/cdn/web/21092026/Laptop-Acer-Aspire-Lite-AL14-47P-R0TR-NX.X0PSV.002-R5-3500U8GB512GB-SSD14.0-FHDWin-11-HomeXam-1.jpg',0,2),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_acer_aspire_lite_15_al15-53p-56qh_-_1.png',1,0),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_acer_aspire_lite_15_al15-53p-56qh_-_2.png',0,1),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_acer_aspire_lite_15_al15-53p-56qh_-_3.png',0,2),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','https://cdn2.cellphones.com.vn/x/media/catalog/product/l/a/laptop_acer_aspire_lite_14_al14-53m-53e8_-_1.png',1,0),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','https://media-asset.cellphones.com.vn/dashboard-v2/uploads/content-uploads/laptop-acer-aspire-lite-14-al14-53m-53e8-637353.jpg',0,1),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','https://media-asset.cellphones.com.vn/dashboard-v2/uploads/content-uploads/laptop-acer-aspire-lite-14-al14-53m-53e8-639278.jpg',0,2),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_go_15_ag15_72p_silver_01_1c230b3131.png',1,0),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/acer_aspire_go_15_ag15_72p_35x9_i3_1305u_1_e99f78cb09.jpg',0,1),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','https://cdn-files.hacom.vn/hacom/cdn/web/30102025/laptop-acer-aspire-go-ag15-72p-54gy-ltac1001_0005_ace1.jpg',0,2),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','https://cdn-files.hacom.vn/hacom/cdn/web/21092026/swift-1.jpg',1,0),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','https://cdn-files.hacom.vn/hacom/cdn/web/21092026/swift-2.jpg',0,1),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','https://cdn-files.hacom.vn/hacom/cdn/web/21092026/swift-3.jpg',0,2),
 ('ACER-ASPIRE-7-A715-59G-59RD','https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/00930069_acer_gaming_aspire_7_a715_59g_59rd_01_32094a5d9d.png',1,0),
 ('ACER-ASPIRE-7-A715-59G-59RD','https://cdn2.fptshop.com.vn/unsafe/750x0/filters:format(webp):quality(75)/00930069_acer_gaming_aspire_7_a715_59g_59rd_02_f2bcd8b716.png',0,1),
 ('ACER-ASPIRE-7-A715-59G-59RD','https://cdn2.fptshop.com.vn/unsafe/800x0/acer_gaming_aspire_7_a715_59g_59rd_1_c9d3fe1965.jpg',0,2),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','https://cdn2.cellphones.com.vn/x/media/wysiwyg/laptop/Acer/Nitro/laptop-acer-gaming-nitro-v-15-propanel-anv15-52-50va-1.jpg',1,0),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','https://cdn2.cellphones.com.vn/x/media/wysiwyg/laptop/Acer/Nitro/laptop-acer-gaming-nitro-v-15-propanel-anv15-52-50va-2.jpg',0,1),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','https://cdn2.cellphones.com.vn/x/media/wysiwyg/laptop/Acer/Nitro/laptop-acer-gaming-nitro-v-15-propanel-anv15-52-50va-3.jpg',0,2),
 ('ACER-ASPIRE-7-A715-59G-53RH','https://cdn-files.hacom.vn/hacom/cdn/web/15092026/Laptop-Acer-Aspire-7-A715-59G-53RH-NH.DV0SV.001-Core-5-210H16GB-RAM512GB-SSDRTX-4050-6GB15.6-FHD-144HzWin-11Den-7.jpg',1,0),
 ('ACER-ASPIRE-7-A715-59G-53RH','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8xNTA5MjAyNi9MYXB0b3AtQWNlci1Bc3BpcmUtNy1BNzE1LTU5Ry01M1JILU5ILkRWMFNWLjAwMS1Db3JlLTUtMjEwSDE2R0ItUkFNNTEyR0ItU1NEUlRYLTQwNTAtNkdCMTUuNi1GSEQtMTQ0SHpXaW4tMTFEZW4tMS5qcGc.webp',0,1),
 ('ACER-ASPIRE-7-A715-59G-53RH','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8xNTA5MjAyNi9MYXB0b3AtQWNlci1Bc3BpcmUtNy1BNzE1LTU5Ry01M1JILU5ILkRWMFNWLjAwMS1Db3JlLTUtMjEwSDE2R0ItUkFNNTEyR0ItU1NEUlRYLTQwNTAtNkdCMTUuNi1GSEQtMTQ0SHpXaW4tMTFEZW4tMi5qcGc.webp',0,2),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','/images/products/acer-nitro-anv15-42.jpg',1,0),
 ('ACER-SWIFT-X-SFX14-71G-78SY','https://cdn2.cellphones.com.vn/insecure/rs:fill:0:0/q:100/plain/https://cellphones.com.vn/media/wysiwyg/laptop/Acer/Swift/laptop-acer-swift-x-sfx14-71g-78sy-2.jpg',1,0),
 ('ACER-SWIFT-X-SFX14-71G-78SY','https://cdn2.cellphones.com.vn/insecure/rs:fill:0:0/q:100/plain/https://cellphones.com.vn/media/wysiwyg/laptop/Acer/Swift/laptop-acer-swift-x-sfx14-71g-78sy-3.jpg',0,1),
 ('ACER-SWIFT-X-SFX14-71G-78SY','https://cdn2.cellphones.com.vn/insecure/rs:fill:0:0/q:100/plain/https://cellphones.com.vn/media/wysiwyg/laptop/Acer/Swift/laptop-acer-swift-x-sfx14-71g-78sy-4.jpg',0,2),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','https://cdn-files.hacom.vn/hacom/cdn/web/14062026/Laptop-Acer-Swift-Go-AI-SFG14-75-765M-NX.JNBSV.004-Ultra-7-258V32GB-LPDDR5X512GB-SSD14.0-FHD-OLEDWin11Xanh-1.jpg',1,0),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','https://cdn-files.hacom.vn/hacom/cdn/web/14062026/Laptop-Acer-Swift-Go-AI-SFG14-75-765M-NX.JNBSV.004-Ultra-7-258V32GB-LPDDR5X512GB-SSD14.0-FHD-OLEDWin11Xanh-2.jpg',0,1),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','https://cdn-files.hacom.vn/hacom/cdn/web/14062026/Laptop-Acer-Swift-Go-AI-SFG14-75-765M-NX.JNBSV.004-Ultra-7-258V32GB-LPDDR5X512GB-SSD14.0-FHD-OLEDWin11Xanh-3.jpg',0,2),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','https://cdn-files.hacom.vn/hacom/cdn/web/01102026/Laptop-Acer-Nitro-Propanel-ANV16-72-71T9-NH.QUNSV.001-Core-7-240H16GB-RAM-D5512GB-SSDRTX5060-8GB16.0FHD-180HzWin11Den-1.jpg',1,0),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','https://cdn-files.hacom.vn/hacom/cdn/web/01102026/Laptop-Acer-Nitro-Propanel-ANV16-72-71T9-NH.QUNSV.001-Core-7-240H16GB-RAM-D5512GB-SSDRTX5060-8GB16.0FHD-180HzWin11Den-2.jpg',0,1),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','https://cdn-files.hacom.vn/hacom/cdn/web/01102026/Laptop-Acer-Nitro-Propanel-ANV16-72-71T9-NH.QUNSV.001-Core-7-240H16GB-RAM-D5512GB-SSDRTX5060-8GB16.0FHD-180HzWin11Den-4.jpg',0,2),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','https://cdn-files.hacom.vn/hacom/cdn/web/15092026/Laptop-Acer-Predator-Helios-18-AI-PH18-I71-975R-NH.U3GSV.001-Ultra-9-290HX-Plus64GB-RAM3TB-SSDRTX-5090-24GB18.0-WQUXGA-120HzWin-11Den-1.jpg',1,0),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8xNTA5MjAyNi9MYXB0b3AtQWNlci1QcmVkYXRvci1IZWxpb3MtMTgtQUktUEgxOC1JNzEtOTc1Ui1OSC5VM0dTVi4wMDEtVWx0cmEtOS0yOTBIWC1QbHVzNjRHQi1SQU0zVEItU1NEUlRYLTUwOTAtMjRHQjE4LjAtV1FVWEdBLTEyMEh6V2luLTExRGVuLTIuanBn.webp',0,1),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','https://cdn-transformations.hacom.vn/insecure/f:webp/q:85/rt:fit/w:1080/aHR0cHM6Ly9jZG4tZmlsZXMuaGFjb20udm4vaGFjb20vY2RuL3dlYi8xNTA5MjAyNi9MYXB0b3AtQWNlci1QcmVkYXRvci1IZWxpb3MtMTgtQUktUEgxOC1JNzEtOTc1Ui1OSC5VM0dTVi4wMDEtVWx0cmEtOS0yOTBIWC1QbHVzNjRHQi1SQU0zVEItU1NEUlRYLTUwOTAtMjRHQjE4LjAtV1FVWEdBLTEyMEh6V2luLTExRGVuLTMuanBn.webp',0,2)
) v(sku,img,isp,ord)
JOIN dbo.Products p ON p.Sku = v.sku;

INSERT INTO dbo.ProductAttributeValues (ProductId, AttributeId, AttrValue)
SELECT p.ProductId, a.AttributeId, v.val FROM (VALUES
 ('MSI-MODERN-14-C11M-011VN','CPU',N'Intel Core i3-1115G4'),
 ('MSI-MODERN-14-C11M-011VN','RAM_SIZE',N'8'),
 ('MSI-MODERN-14-C11M-011VN','RAM_TYPE',N'DDR4'),
 ('MSI-MODERN-14-C11M-011VN','STORAGE',N'512GB SSD NVMe'),
 ('MSI-MODERN-14-C11M-011VN','SSD_INTERFACE',N'M.2 NVMe'),
 ('MSI-MODERN-14-C11M-011VN','SCREEN',N'14.0'),
 ('MSI-MODERN-15-F1MG-1225VN','CPU',N'Intel Core 5-120U'),
 ('MSI-MODERN-15-F1MG-1225VN','RAM_SIZE',N'16'),
 ('MSI-MODERN-15-F1MG-1225VN','STORAGE',N'512GB SSD'),
 ('MSI-MODERN-15-F1MG-1225VN','SCREEN',N'15.6'),
 ('MSI-MODERN-14-H1M-014VN','CPU',N'Intel Core 7-150U'),
 ('MSI-MODERN-14-H1M-014VN','RAM_SIZE',N'16'),
 ('MSI-MODERN-14-H1M-014VN','STORAGE',N'512GB SSD'),
 ('MSI-MODERN-14-H1M-014VN','SCREEN',N'14'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','CPU',N'Intel Core i5-13420H'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','GPU',N'NVIDIA RTX 4050 6GB'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','RAM_SIZE',N'16'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','STORAGE',N'512GB SSD'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2','SCREEN',N'15.6'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','CPU',N'Intel Core i7-13620H'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','GPU',N'NVIDIA RTX 4050 6GB'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','RAM_SIZE',N'16'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','STORAGE',N'512GB SSD'),
 ('MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1','SCREEN',N'15.6'),
 ('MSI-CYBORG-15-C13WEO-418VN','CPU',N'Intel Core i5-13420H'),
 ('MSI-CYBORG-15-C13WEO-418VN','GPU',N'NVIDIA RTX 5050 8GB'),
 ('MSI-CYBORG-15-C13WEO-418VN','RAM_SIZE',N'16'),
 ('MSI-CYBORG-15-C13WEO-418VN','STORAGE',N'512GB SSD'),
 ('MSI-CYBORG-15-C13WEO-418VN','SCREEN',N'15.6'),
 ('MSI-CYBORG-15-C13WEO-418VN','REFRESH_RATE',N'144'),
 ('MSI-MODERN-16S-G3MG-016VN','CPU',N'Intel Core 7-350'),
 ('MSI-MODERN-16S-G3MG-016VN','RAM_SIZE',N'16'),
 ('MSI-MODERN-16S-G3MG-016VN','STORAGE',N'1TB SSD'),
 ('MSI-MODERN-16S-G3MG-016VN','SCREEN',N'16'),
 ('MSI-MODERN-16S-AI-G3MG-058VN','CPU',N'Intel Core Ultra 7-355'),
 ('MSI-MODERN-16S-AI-G3MG-058VN','RAM_SIZE',N'16'),
 ('MSI-MODERN-16S-AI-G3MG-058VN','STORAGE',N'1TB SSD'),
 ('MSI-MODERN-16S-AI-G3MG-058VN','SCREEN',N'16'),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','CPU',N'Intel Core Ultra 7-355'),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','RAM_SIZE',N'32'),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','STORAGE',N'1TB SSD'),
 ('MSI-PRESTIGE-14-AI-D3MG-022VN','SCREEN',N'14'),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','CPU',N'Intel Core Ultra 7'),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','RAM_SIZE',N'32'),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','STORAGE',N'1TB SSD'),
 ('MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN','SCREEN',N'13.3'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','CPU',N'Intel Core i7-13620H'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','GPU',N'NVIDIA RTX 5050 8GB'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','RAM_SIZE',N'16'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','STORAGE',N'512GB SSD'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','SCREEN',N'15.6'),
 ('MSI-CYBORG-15-MAX-C13WE-422VN','REFRESH_RATE',N'144'),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','CPU',N'Intel Pentium Silver N5030'),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','RAM_SIZE',N'4'),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','STORAGE',N'256GB SSD NVMe'),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','SSD_INTERFACE',N'M.2 NVMe'),
 ('LEN-IDEAPAD-1-PENTIUM-SILVER-N5030','SCREEN',N'11.6'),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','CPU',N'Intel Core 3-304'),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','RAM_SIZE',N'8'),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','STORAGE',N'512GB SSD'),
 ('LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV','SCREEN',N'14'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','CPU',N'AMD Ryzen 5-125'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','RAM_SIZE',N'8'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','STORAGE',N'512GB SSD'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV','SCREEN',N'16'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','CPU',N'AMD Ryzen 7-155'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','RAM_SIZE',N'8'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','STORAGE',N'512GB SSD'),
 ('LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V','SCREEN',N'16'),
 ('LEN-LOQ-15ARP10E-83S0006RVN','CPU',N'AMD Ryzen 7-7735HS'),
 ('LEN-LOQ-15ARP10E-83S0006RVN','GPU',N'NVIDIA RTX 3050 6GB'),
 ('LEN-LOQ-15ARP10E-83S0006RVN','RAM_SIZE',N'16'),
 ('LEN-LOQ-15ARP10E-83S0006RVN','STORAGE',N'1TB SSD'),
 ('LEN-LOQ-15ARP10E-83S0006RVN','SCREEN',N'15.6'),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','CPU',N'AMD Ryzen AI 5-330'),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','RAM_SIZE',N'16'),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','STORAGE',N'512GB SSD'),
 ('LEN-IDEAPAD-SLIM-5-14AKP10-OLED-83HX','SCREEN',N'14'),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','CPU',N'AMD Ryzen AI 7-445'),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','RAM_SIZE',N'16'),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','STORAGE',N'512GB SSD'),
 ('LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1','SCREEN',N'14'),
 ('LEN-LOQ-15IRX10-83JE01AGVN','CPU',N'Intel Core i7-13645HX'),
 ('LEN-LOQ-15IRX10-83JE01AGVN','GPU',N'NVIDIA RTX 5050 8GB'),
 ('LEN-LOQ-15IRX10-83JE01AGVN','RAM_SIZE',N'16'),
 ('LEN-LOQ-15IRX10-83JE01AGVN','STORAGE',N'512GB SSD'),
 ('LEN-LOQ-15IRX10-83JE01AGVN','SCREEN',N'15.6'),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','CPU',N'Intel Core Ultra 7-355'),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','RAM_SIZE',N'16'),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','STORAGE',N'512GB SSD'),
 ('LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007','SCREEN',N'14'),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','CPU',N'Intel Core Ultra 7-251HX'),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','GPU',N'NVIDIA RTX 5060'),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','RAM_SIZE',N'24'),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','STORAGE',N'512GB SSD'),
 ('LEN-LEGION-5-15IAX11-83VK00A3VN','SCREEN',N'15.6'),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','CPU',N'Intel Core Ultra 9-275HX'),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','GPU',N'NVIDIA RTX 5070 Ti'),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','RAM_SIZE',N'32'),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','STORAGE',N'1TB SSD'),
 ('LEN-LEGION-PRO-7-16IAX10H-83F500JGVN','SCREEN',N'16'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','CPU',N'Intel Core 3-100U'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','RAM_SIZE',N'8'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','RAM_TYPE',N'DDR5'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','STORAGE',N'512GB SSD NVMe'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','SSD_INTERFACE',N'M.2 NVMe'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','SCREEN',N'15.6'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD','REFRESH_RATE',N'120'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','CPU',N'Intel Core i5-1334U'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','RAM_SIZE',N'8'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','STORAGE',N'512GB SSD'),
 ('DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1','SCREEN',N'15.6'),
 ('DELL-16-DC16251-I5-120U','CPU',N'Intel Core i5-120U'),
 ('DELL-16-DC16251-I5-120U','RAM_SIZE',N'8'),
 ('DELL-16-DC16251-I5-120U','STORAGE',N'512GB SSD'),
 ('DELL-16-DC16251-I5-120U','SCREEN',N'16'),
 ('DELL-DC15250-7982BLK-H5YXJ','CPU',N'Intel Core i7-1355U'),
 ('DELL-DC15250-7982BLK-H5YXJ','RAM_SIZE',N'16'),
 ('DELL-DC15250-7982BLK-H5YXJ','STORAGE',N'1TB SSD'),
 ('DELL-DC15250-7982BLK-H5YXJ','SCREEN',N'15.6'),
 ('DELL-15-DC15255-X9YM41','CPU',N'AMD Ryzen 7 7730U'),
 ('DELL-15-DC15255-X9YM41','RAM_SIZE',N'16'),
 ('DELL-15-DC15255-X9YM41','STORAGE',N'1TB SSD'),
 ('DELL-15-DC15255-X9YM41','SCREEN',N'15.6'),
 ('DELL-15-DC15255-X9YM41','REFRESH_RATE',N'120'),
 ('DELL-INSPIRON-5441-5MNK1','CPU',N'Qualcomm Snapdragon X1P'),
 ('DELL-INSPIRON-5441-5MNK1','RAM_SIZE',N'16'),
 ('DELL-INSPIRON-5441-5MNK1','STORAGE',N'512GB SSD'),
 ('DELL-INSPIRON-5441-5MNK1','SCREEN',N'14'),
 ('DELL-15-DC15250-CPH991','CPU',N'Intel Core i7-1355U'),
 ('DELL-15-DC15250-CPH991','RAM_SIZE',N'16'),
 ('DELL-15-DC15250-CPH991','STORAGE',N'1TB SSD'),
 ('DELL-15-DC15250-CPH991','SCREEN',N'15.6'),
 ('DELL-15-DC15250-CPH991','REFRESH_RATE',N'120'),
 ('DELL-14-DC14250-F0FTK5','CPU',N'Intel Core 5-120U'),
 ('DELL-14-DC14250-F0FTK5','RAM_SIZE',N'16'),
 ('DELL-14-DC14250-F0FTK5','STORAGE',N'1TB SSD'),
 ('DELL-14-DC14250-F0FTK5','SCREEN',N'14'),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','CPU',N'Intel Core 5-120U'),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','RAM_SIZE',N'16'),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','STORAGE',N'512GB SSD'),
 ('DELL-PRO-14-ESSENTIAL-PV14250-120U-1','SCREEN',N'14'),
 ('DELL-16-DC16251-DC6C7557W1','CPU',N'Intel Core 7-150U'),
 ('DELL-16-DC16251-DC6C7557W1','GPU',N'NVIDIA MX570A'),
 ('DELL-16-DC16251-DC6C7557W1','RAM_SIZE',N'16'),
 ('DELL-16-DC16251-DC6C7557W1','STORAGE',N'1TB SSD'),
 ('DELL-16-DC16251-DC6C7557W1','SCREEN',N'16'),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','CPU',N'Intel Core Ultra 5-235U vPro'),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','RAM_SIZE',N'16'),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','STORAGE',N'512GB SSD'),
 ('DELL-PRO-14-PLUS-PB14250-235U-16512W','SCREEN',N'14'),
 ('DELL-16-PLUS-DB16250-X65NW7','CPU',N'Intel Core Ultra 7-256V'),
 ('DELL-16-PLUS-DB16250-X65NW7','RAM_SIZE',N'16'),
 ('DELL-16-PLUS-DB16250-X65NW7','STORAGE',N'1TB SSD'),
 ('DELL-16-PLUS-DB16250-X65NW7','SCREEN',N'16'),
 ('DELL-16-PLUS-DB16250-X65NW7','REFRESH_RATE',N'120'),
 ('DELL-XPS-13-DX13260-DX3C5376W1','CPU',N'Intel Core 5-320'),
 ('DELL-XPS-13-DX13260-DX3C5376W1','RAM_SIZE',N'16'),
 ('DELL-XPS-13-DX13260-DX3C5376W1','STORAGE',N'512GB SSD'),
 ('DELL-XPS-13-DX13260-DX3C5376W1','SCREEN',N'13.4'),
 ('DELL-XPS-13-DX13260-DX3C5376W1','REFRESH_RATE',N'120'),
 ('ASUS-D515DA-EJ845T','CPU',N'AMD Ryzen 3-3250U'),
 ('ASUS-D515DA-EJ845T','RAM_SIZE',N'4'),
 ('ASUS-D515DA-EJ845T','RAM_TYPE',N'DDR4'),
 ('ASUS-D515DA-EJ845T','STORAGE',N'512GB SSD NVMe'),
 ('ASUS-D515DA-EJ845T','SSD_INTERFACE',N'M.2 NVMe'),
 ('ASUS-D515DA-EJ845T','SCREEN',N'15.6'),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','CPU',N'Intel Core 3-100U'),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','RAM_SIZE',N'8'),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50','SCREEN',N'14'),
 ('ASUS-VIVOBOOK-14-X1404V','CPU',N'Intel Core 5-120U'),
 ('ASUS-VIVOBOOK-14-X1404V','RAM_SIZE',N'8'),
 ('ASUS-VIVOBOOK-14-X1404V','STORAGE',N'256GB SSD'),
 ('ASUS-VIVOBOOK-14-X1404V','SCREEN',N'14'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','CPU',N'Intel Core 5-210H'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','RAM_SIZE',N'8'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H08-50W','SCREEN',N'14'),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','CPU',N'AMD Ryzen 5-150'),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','RAM_SIZE',N'16'),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W','SCREEN',N'14'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','CPU',N'Intel Core 5-210H'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','RAM_SIZE',N'16'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P1403CVA-C5H16-50W','SCREEN',N'14'),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','CPU',N'Intel Core 5-210H'),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','RAM_SIZE',N'16'),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','SCREEN',N'15.6'),
 ('ASUS-EXPERTBOOK-P1503CVA-S72922W','REFRESH_RATE',N'60'),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','CPU',N'Intel Core 7-150U'),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','RAM_SIZE',N'16'),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','STORAGE',N'512GB SSD'),
 ('ASUS-VIVOBOOK-14-X1404VA-EB355W','SCREEN',N'14'),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','CPU',N'AMD Ryzen 5-40'),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','RAM_SIZE',N'16'),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','STORAGE',N'512GB SSD'),
 ('ASUS-VIVOBOOK-GO-14-E1404FA-EB935W','SCREEN',N'14'),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','CPU',N'AMD Ryzen 7 8845HS'),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','GPU',N'NVIDIA RTX 3050'),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','RAM_SIZE',N'16'),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','STORAGE',N'512GB SSD'),
 ('ASUS-TUF-GAMING-A15-FA506NCG-HN329W','SCREEN',N'15.6'),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','CPU',N'Intel Core Ultra 5-225H'),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','RAM_SIZE',N'16'),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516','SCREEN',N'14'),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','CPU',N'Intel Core Ultra 5-225H'),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','RAM_SIZE',N'16'),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','STORAGE',N'512GB SSD'),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','SCREEN',N'14'),
 ('ASUS-ZENBOOK-14-UX3405CA-ST1713W','REFRESH_RATE',N'120'),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','CPU',N'Intel Core Ultra 7-255H'),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','RAM_SIZE',N'16'),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','STORAGE',N'512GB SSD'),
 ('ASUS-EXPERTBOOK-P3-P3406CCAP-U716W','SCREEN',N'14'),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','CPU',N'Intel Core Ultra 9'),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','RAM_SIZE',N'16'),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','STORAGE',N'512GB SSD'),
 ('ASUS-ZENBOOK-S-14-UX5406AA-SU348W','SCREEN',N'14'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','CPU',N'AMD Ryzen AI 9 365'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','GPU',N'NVIDIA RTX 5060'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','RAM_SIZE',N'32'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','STORAGE',N'512GB SSD'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','SCREEN',N'14'),
 ('ASUS-ROG-ZEPHYRUS-G14-GA403GM-SY201W','REFRESH_RATE',N'120'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','CPU',N'Intel Core i3-N305'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','RAM_SIZE',N'8'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','RAM_TYPE',N'LPDDR5'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','STORAGE',N'256GB SSD NVMe'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','SSD_INTERFACE',N'M.2 NVMe'),
 ('ACER-ASPIRE-LITE-14-AL14-2025-N305','SCREEN',N'14'),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','CPU',N'AMD Ryzen 5-3500U'),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','RAM_SIZE',N'8'),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-LITE-15-AL15-410P-R1W8','SCREEN',N'15.6'),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','CPU',N'AMD Ryzen 5-3500U'),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','RAM_SIZE',N'8'),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-LITE-14-AL14-47P-R0TR','SCREEN',N'14'),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','CPU',N'Intel Core 5-120U'),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','RAM_SIZE',N'8'),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-LITE-15-AL15-53P-56QH','SCREEN',N'15.6'),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','CPU',N'Intel Core 5-120U'),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','RAM_SIZE',N'16'),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-LITE-14-AL14-53M-53E8','SCREEN',N'14'),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','CPU',N'Intel Core 7-150U'),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','RAM_SIZE',N'16'),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-GO-15-AG15-72P-776J','SCREEN',N'15.6'),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','CPU',N'Intel Core 5-320'),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','RAM_SIZE',N'12'),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','STORAGE',N'512GB SSD'),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','SCREEN',N'14'),
 ('ACER-SWIFT-AIR-14-SFA14-I31-52BV','REFRESH_RATE',N'120'),
 ('ACER-ASPIRE-7-A715-59G-59RD','CPU',N'Intel Core 5-210H'),
 ('ACER-ASPIRE-7-A715-59G-59RD','GPU',N'NVIDIA RTX 3050 4GB'),
 ('ACER-ASPIRE-7-A715-59G-59RD','RAM_SIZE',N'16'),
 ('ACER-ASPIRE-7-A715-59G-59RD','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-7-A715-59G-59RD','SCREEN',N'15.6'),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','CPU',N'Intel Core 5-210H'),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','GPU',N'NVIDIA RTX 3050'),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','RAM_SIZE',N'16'),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','STORAGE',N'512GB SSD'),
 ('ACER-NITRO-PROPANEL-ANV15-52-50VA','SCREEN',N'15.6'),
 ('ACER-ASPIRE-7-A715-59G-53RH','CPU',N'Intel Core 5-210H'),
 ('ACER-ASPIRE-7-A715-59G-53RH','GPU',N'NVIDIA RTX 4050 6GB'),
 ('ACER-ASPIRE-7-A715-59G-53RH','RAM_SIZE',N'16'),
 ('ACER-ASPIRE-7-A715-59G-53RH','STORAGE',N'512GB SSD'),
 ('ACER-ASPIRE-7-A715-59G-53RH','SCREEN',N'15.6'),
 ('ACER-ASPIRE-7-A715-59G-53RH','REFRESH_RATE',N'144'),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','CPU',N'AMD Ryzen 5 7640HS'),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','GPU',N'NVIDIA RTX 4050 6GB'),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','RAM_SIZE',N'16'),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','STORAGE',N'512GB SSD'),
 ('ACER-NITRO-PROPANEL-ANV15-42-R5EF','SCREEN',N'15.6'),
 ('ACER-SWIFT-X-SFX14-71G-78SY','CPU',N'Intel Core i7-13700H'),
 ('ACER-SWIFT-X-SFX14-71G-78SY','GPU',N'NVIDIA RTX 4050 6GB'),
 ('ACER-SWIFT-X-SFX14-71G-78SY','RAM_SIZE',N'32'),
 ('ACER-SWIFT-X-SFX14-71G-78SY','STORAGE',N'1TB SSD'),
 ('ACER-SWIFT-X-SFX14-71G-78SY','SCREEN',N'14.5'),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','CPU',N'Intel Core Ultra 7-258V'),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','RAM_SIZE',N'32'),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','STORAGE',N'512GB SSD'),
 ('ACER-SWIFT-GO-AI-OLED-SFG14-75-765M','SCREEN',N'14'),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','CPU',N'Intel Core 7-240H'),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','GPU',N'NVIDIA RTX 5060'),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','RAM_SIZE',N'16'),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','STORAGE',N'512GB SSD'),
 ('ACER-NITRO-PROPANEL-ANV16-72-71T9','SCREEN',N'16.0'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','CPU',N'Intel Core Ultra 9-290HX Plus'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','GPU',N'NVIDIA RTX 5080 16GB'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','RAM_SIZE',N'64'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','STORAGE',N'3TB SSD'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','SCREEN',N'18'),
 ('ACER-PREDATOR-HELIOS-18-AI-PH18-I71','REFRESH_RATE',N'250')
) v(sku,code,val)
JOIN dbo.Products p ON p.Sku = v.sku JOIN dbo.Attributes a ON a.AttrCode = v.code;

/* ---------- 5. Nhà cung cấp / khuyến mãi ---------- */
INSERT INTO dbo.Suppliers (SupplierName, TaxCode, ContactName, Phone, Email, Address, PaymentTermDays) VALUES
 (N'Công ty CP FPT Synnex',  '0301234567', N'Nguyễn Hữu Phước','0281111111','sales@synnex.vn', N'Quận 7, TP.HCM', 30),
 (N'Công ty CP Digiworld (DGW)','0302345678', N'Trần Quốc Bảo', '0282222222','sales@dgw.vn',   N'Quận 3, TP.HCM', 45),
 (N'Công ty Viễn Sơn',        '0303456789', N'Lê Thanh Sơn',   '0283333333','sales@vienson.vn',N'Quận 10, TP.HCM', 15);

INSERT INTO dbo.Promotions (Code, PromoName, DiscountType, DiscountValue, MinOrderAmount, MaxDiscount, StartDate, EndDate, UsageLimit) VALUES
 ('WELCOME10', N'Chào bạn mới - giảm 10%',        'Percent', 10, 5000000, 1000000, DATEADD(MONTH,-2,SYSDATETIME()), DATEADD(MONTH,6,SYSDATETIME()), 100),
 ('GIAM500K',  N'Giảm 500.000đ cho đơn từ 10 triệu','Amount', 500000, 10000000, NULL, DATEADD(MONTH,-1,SYSDATETIME()), DATEADD(MONTH,3,SYSDATETIME()), 50),
 ('TET2026',   N'Khuyến mãi Tết (đã hết hạn)',     'Percent', 15, 0, 2000000, '2026-01-10', '2026-02-20', NULL),
 ('BTS2026',   N'Back to School - giảm 8% laptop & linh kiện', 'Percent', 8, 3000000, 1500000, DATEADD(MONTH,-1,SYSDATETIME()), DATEADD(MONTH,2,SYSDATETIME()), 500);

/* ---------- 6. Nhập kho (3 phiếu, có serial) ---------- */
DECLARE @emp INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV003');
DECLARE @s1 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0301234567');
DECLARE @s2 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0302345678');
DECLARE @s3 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0303456789');
DECLARE @d DATETIME2(0) = DATEADD(DAY,-95,SYSDATETIME());
DECLARE @g1 INT, @g2 INT, @g3 INT, @n INT;

-- Đệm 0 tới tối thiểu 5 ký tự, KHÔNG BAO GIỜ cắt bớt số (tránh trùng mã khi sequence vượt 99999 trong cùng kỳ yyMM).
DECLARE @nStr VARCHAR(10);

SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo; SET @nStr = CAST(@n AS VARCHAR(10));
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT(REPLICATE('0',5)+@nStr, CASE WHEN LEN(@nStr)>5 THEN LEN(@nStr) ELSE 5 END), @s1, @emp, @d, N'Nhập laptop lô đầu');
SET @g1 = SCOPE_IDENTITY();
SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo; SET @nStr = CAST(@n AS VARCHAR(10));
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT(REPLICATE('0',5)+@nStr, CASE WHEN LEN(@nStr)>5 THEN LEN(@nStr) ELSE 5 END), @s2, @emp, @d, N'Nhập laptop đồ hoạ, RAM, SSD');
SET @g2 = SCOPE_IDENTITY();
SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo; SET @nStr = CAST(@n AS VARCHAR(10));
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT(REPLICATE('0',5)+@nStr, CASE WHEN LEN(@nStr)>5 THEN LEN(@nStr) ELSE 5 END), @s3, @emp, @d, N'Nhập phụ kiện');
SET @g3 = SCOPE_IDENTITY();

INSERT INTO dbo.GoodsReceiptDetails (ReceiptId, ProductId, Quantity, UnitCost)
SELECT CASE v.g WHEN 1 THEN @g1 WHEN 2 THEN @g2 ELSE @g3 END, p.ProductId, v.qty, p.CostPrice FROM (VALUES
 (1,'ASUS-TUF-F15',10),(1,'MSI-KATANA-15',8),(1,'LENOVO-LOQ-15',8),(1,'DELL-INS-15',10),(1,'HP-15S',12),(1,'LENOVO-IDEA5',9),(1,'MBA-M2',5),
 (1,'MSI-MODERN-14-C11M-011VN',2),(1,'MSI-MODERN-15-F1MG-1225VN',9),(1,'MSI-MODERN-14-H1M-014VN',14),(1,'MSI-CYBORG-15-BLACK-EDITION-A13VEO-2',1),(1,'MSI-CYBORG-15-BLACK-EDITION-A13VEO-2-1',6),(1,'MSI-MODERN-16S-G3MG-016VN',4),(1,'MSI-MODERN-16S-AI-G3MG-058VN',12),(1,'MSI-PRESTIGE-14-AI-D3MG-022VN',3),(1,'MSI-PRESTIGE-13-AI-EVO-A2VMG-040VN',7),(1,'MSI-CYBORG-15-MAX-C13WE-422VN',18),(1,'LEN-IDEAPAD-1-PENTIUM-SILVER-N5030',2),(1,'LEN-IDEAPAD-SLIM-3-14IWC11-83RQ00DBV',9),(1,'LEN-IDEAPAD-SLIM-3-16AHP10-83KB005YV',14),(1,'LEN-IDEAPAD-SLIM-3-16AHP10-83KB0060V',1),(1,'LEN-LOQ-15ARP10E-83S0006RVN',6),(1,'LEN-IDEAPAD-SLIM-5-14AGP11-OLED-83S1',4),(1,'LEN-LOQ-15IRX10-83JE01AGVN',12),(1,'LEN-YOGA-SLIM-7-14IPH11-OLED-83QM007',3),(1,'LEN-LEGION-5-15IAX11-83VK00A3VN',7),(1,'LEN-LEGION-PRO-7-16IAX10H-83F500JGVN',18),
 (1,'DELL-15-PRO-ESSENTIAL-PV15250-VKVKD',2),(1,'DELL-15-PRO-ESSENTIAL-PV15250-VKVKD-1',9),(1,'DELL-16-DC16251-I5-120U',14),(1,'DELL-DC15250-7982BLK-H5YXJ',1),(1,'DELL-15-DC15255-X9YM41',6),(1,'DELL-15-DC15250-CPH991',4),(1,'DELL-14-DC14250-F0FTK5',12),(1,'DELL-PRO-14-ESSENTIAL-PV14250-120U-1',3),(1,'DELL-16-DC16251-DC6C7557W1',7),(1,'DELL-PRO-14-PLUS-PB14250-235U-16512W',18),(1,'DELL-16-PLUS-DB16250-X65NW7',2),(1,'DELL-XPS-13-DX13260-DX3C5376W1',9),(1,'ASUS-D515DA-EJ845T',14),(1,'ASUS-EXPERTBOOK-P1-P1403CVA-C3U08-50',1),(1,'ASUS-VIVOBOOK-14-X1404V',6),(1,'ASUS-EXPERTBOOK-B1-BM1403CDA-S61611W',4),(1,'ASUS-EXPERTBOOK-P1403CVA-C5H16-50W',12),(1,'ASUS-EXPERTBOOK-P1503CVA-S72922W',3),(1,'ASUS-VIVOBOOK-14-X1404VA-EB355W',7),(1,'ASUS-VIVOBOOK-GO-14-E1404FA-EB935W',18),(1,'ASUS-TUF-GAMING-A15-FA506NCG-HN329W',2),(1,'ASUS-EXPERTBOOK-P3-G1-P3406CCAP-U516',9),(1,'ASUS-ZENBOOK-14-UX3405CA-ST1713W',14),(1,'ASUS-EXPERTBOOK-P3-P3406CCAP-U716W',1),(1,'ASUS-ZENBOOK-S-14-UX5406AA-SU348W',6),
 (1,'ACER-ASPIRE-LITE-14-AL14-2025-N305',4),(1,'ACER-ASPIRE-LITE-15-AL15-410P-R1W8',12),(1,'ACER-ASPIRE-LITE-14-AL14-47P-R0TR',3),(1,'ACER-ASPIRE-LITE-15-AL15-53P-56QH',7),(1,'ACER-ASPIRE-LITE-14-AL14-53M-53E8',18),(1,'ACER-ASPIRE-GO-15-AG15-72P-776J',2),(1,'ACER-SWIFT-AIR-14-SFA14-I31-52BV',9),(1,'ACER-ASPIRE-7-A715-59G-59RD',14),(1,'ACER-NITRO-PROPANEL-ANV15-52-50VA',1),(1,'ACER-ASPIRE-7-A715-59G-53RH',6),(1,'ACER-SWIFT-X-SFX14-71G-78SY',4),(1,'ACER-SWIFT-GO-AI-OLED-SFG14-75-765M',12),(1,'ACER-NITRO-PROPANEL-ANV16-72-71T9',3),(1,'ACER-PREDATOR-HELIOS-18-AI-PH18-I71',7),
 (2,'ASUS-VIVO-PRO',4),(2,'DELL-XPS-15',3),(2,'KVR-D4-8',10),(2,'KVR-D5-16',10),(2,'CRU-D5-8',8),(2,'SAM-980-500',10),(2,'SAM-980P-1TB',8),(2,'KIN-A400-480',10),
 (3,'LOGI-G102',30),(3,'LOGI-MXM3S',12),(3,'RAZER-DAV3',10),(3,'CORSAIR-K70',8),(3,'LOGI-K380',15),(3,'RAZER-BSV2X',10),(3,'ASUS-ROG-BP',15),(3,'ANKER-737',10),(3,'ANKER-PL3',40)
) v(g,sku,qty) JOIN dbo.Products p ON p.Sku = v.sku;

-- Sinh serial cho sản phẩm quản lý theo serial (trạng thái Pending, chốt phiếu sẽ chuyển InStock)
SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n INTO #Tally FROM sys.all_objects;
INSERT INTO dbo.ProductSerials (ProductId, SerialNumber, ReceiptDetailId, Status)
SELECT d.ProductId,
       CONCAT(p.Sku, '-', RIGHT('000' + CAST(d.ReceiptDetailId AS VARCHAR(10)), 3), '-', RIGHT('000' + CAST(t.n AS VARCHAR(10)), 3)),
       d.ReceiptDetailId, 'Pending'
FROM dbo.GoodsReceiptDetails d
JOIN dbo.Products p ON p.ProductId = d.ProductId AND p.IsSerialTracked = 1
JOIN #Tally t ON t.n <= d.Quantity;
DROP TABLE #Tally;

DECLARE @empAcc INT = (SELECT AccountId FROM dbo.Employees WHERE EmployeeCode = 'NV003');
EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g1, @AccountId = @empAcc;
EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g2, @AccountId = @empAcc;
EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g3, @AccountId = @empAcc;
-- Nhà cung cấp đã thanh toán một phần
UPDATE dbo.GoodsReceipts SET PaidAmount = TotalAmount WHERE ReceiptId = @g1;
UPDATE dbo.GoodsReceipts SET PaidAmount = TotalAmount / 2 WHERE ReceiptId = @g2;
UPDATE dbo.GoodsReceipts SET DueDate = DATEADD(DAY, 10, CAST(SYSDATETIME() AS DATE)) WHERE ReceiptId = @g3;  -- sắp đến hạn trả nhà cung cấp
-- Sắp hết hàng để demo cảnh báo (ReorderLevel cao hơn tồn)
UPDATE dbo.Products SET ReorderLevel = 4 WHERE Sku IN ('DELL-XPS-15','MBA-M2','ASUS-VIVO-PRO');
GO

/* ---------- 6b. Dữ liệu bổ sung: khách hàng, nhà cung cấp, khuyến mãi, linh kiện / phụ kiện ---------- */
DECLARE @pw VARCHAR(100) = '$2a$10$aIj0Aka6.Kx51wcOrJBjv./ehFPfPSB/LpdLQ3qCXOhxsEPXDfxRq';  -- bcrypt("123456")
INSERT INTO dbo.Accounts (Username, Email, PasswordHash, RoleId)
SELECT v.u, v.e, @pw, r.RoleId FROM (VALUES
 ('khach4',  'khach4@gmail.com'),  ('khach5',  'khach5@gmail.com'),  ('khach6',  'khach6@gmail.com'),
 ('khach7',  'khach7@gmail.com'),  ('khach8',  'khach8@gmail.com'),  ('khach9',  'khach9@gmail.com'),
 ('khach10', 'khach10@gmail.com')) v(u,e)
CROSS JOIN dbo.Roles r WHERE r.RoleCode = 'CUSTOMER';

INSERT INTO dbo.Customers (AccountId, FullName, Phone, Email, CompanyName, TaxCode)
SELECT a.AccountId, v.fn, v.ph, v.em, v.co, v.tx FROM (VALUES
 ('khach4', N'Võ Thị Mai',        '0912000004','khach4@gmail.com', NULL, NULL),
 ('khach5', N'Đặng Quốc Bảo',     '0912000005','khach5@gmail.com', NULL, NULL),
 ('khach6', N'Bùi Anh Thư',       '0912000006','khach6@gmail.com', NULL, NULL),
 ('khach7', N'Hoàng Gia Huy',     '0912000007','khach7@gmail.com', N'Công ty CP Công nghệ Gia Huy','0109876543'),
 ('khach8', N'Ngô Thanh Tâm',     '0912000008','khach8@gmail.com', NULL, NULL),
 ('khach9', N'Đỗ Minh Châu',      '0912000009','khach9@gmail.com', NULL, NULL),
 ('khach10',N'Lý Hải Đăng',       '0912000010','khach10@gmail.com',NULL, NULL)) v(u,fn,ph,em,co,tx)
JOIN dbo.Accounts a ON a.Username = v.u;

INSERT INTO dbo.CustomerAddresses (CustomerId, ReceiverName, ReceiverPhone, AddressLine, Ward, District, Province, IsDefault)
SELECT c.CustomerId, v.rn, v.rp, v.al, v.w, v.d, v.p, v.def FROM (VALUES
 ('0912000004',N'Võ Thị Mai','0912000004',N'25 Lý Thường Kiệt',N'Phường 7',N'Quận 10',N'TP. Hồ Chí Minh',1),
 ('0912000005',N'Đặng Quốc Bảo','0912000005',N'102 Nguyễn Trãi',N'Thanh Xuân Trung',N'Thanh Xuân',N'Hà Nội',1),
 ('0912000006',N'Bùi Anh Thư','0912000006',N'7 Bạch Đằng',N'Hải Châu 1',N'Hải Châu',N'Đà Nẵng',1),
 ('0912000007',N'Hoàng Gia Huy','0912000007',N'360 Nguyễn Văn Linh',N'Tân Thuận Tây',N'Quận 7',N'TP. Hồ Chí Minh',1),
 ('0912000007',N'Văn phòng Gia Huy','0912888777',N'18 Trần Phú',N'Mỗ Lao',N'Hà Đông',N'Hà Nội',0),
 ('0912000008',N'Ngô Thanh Tâm','0912000008',N'51 Đường 30/4',N'Xuân Khánh',N'Ninh Kiều',N'Cần Thơ',1),
 ('0912000009',N'Đỗ Minh Châu','0912000009',N'14 Lê Lợi',N'Phường 1',N'TP. Biên Hòa',N'Đồng Nai',1),
 ('0912000010',N'Lý Hải Đăng','0912000010',N'33 Điện Biên Phủ',N'Máy Tơ',N'Ngô Quyền',N'Hải Phòng',1))
 v(ph,rn,rp,al,w,d,p,def) JOIN dbo.Customers c ON c.Phone = v.ph;

INSERT INTO dbo.Suppliers (SupplierName, TaxCode, ContactName, Phone, Email, Address, PaymentTermDays) VALUES
 (N'Công ty TNHH Thế Giới Laptop', '0304567890', N'Phạm Hồng Quân',  '0284444444','sales@thegioilaptop.vn', N'Quận Tân Bình, TP.HCM', 30),
 (N'Công ty TNHH Thiết Bị Số An Phát','0305678901', N'Đinh Thị Lan',   '0285555555','sales@anphatdigital.vn', N'Quận Gò Vấp, TP.HCM', 7);

INSERT INTO dbo.Promotions (Code, PromoName, DiscountType, DiscountValue, MinOrderAmount, MaxDiscount, StartDate, EndDate, UsageLimit) VALUES
 ('LAPTOP5',  N'Laptop giảm 5% cho đơn từ 15 triệu',  'Percent', 5,      15000000, 3000000, DATEADD(WEEK,-2,SYSDATETIME()),  DATEADD(MONTH,4,SYSDATETIME()), 200),
 ('SAVE200K', N'Giảm 200.000đ cho đơn từ 2 triệu',    'Amount',  200000, 2000000,  NULL,    DATEADD(MONTH,-1,SYSDATETIME()), DATEADD(MONTH,2,SYSDATETIME()), 20),
 ('FLASH20',  N'Flash sale 20% (đã kết thúc)',        'Percent', 20,     0,        3000000, DATEADD(MONTH,-2,SYSDATETIME()), DATEADD(MONTH,-1,SYSDATETIME()), 30),
 ('NOEL2026', N'Giáng sinh - sắp diễn ra',            'Percent', 12,     5000000,  2000000, DATEADD(DAY,40,SYSDATETIME()),   DATEADD(DAY,70,SYSDATETIME()), NULL);

INSERT INTO dbo.Brands (BrandName, Country) VALUES
 (N'Western Digital', N'Mỹ'), (N'SteelSeries', N'Đan Mạch'), (N'Baseus', N'Trung Quốc');

-- Linh kiện / phụ kiện bổ sung (mỗi danh mục có vài mức giá và thương hiệu để lọc, sắp xếp cho khác nhau)
INSERT INTO dbo.Products (Sku, ProductName, Slug, CategoryId, BrandId, ShortDesc, CostPrice, SalePrice, WarrantyMonths, IsSerialTracked)
SELECT v.sku, v.n, v.slug, c.CategoryId, b.BrandId, v.sd, v.cost, v.price, v.war, v.ser
FROM (VALUES
 ('KIN-FURY-D5-32', N'Kingston Fury Impact 32GB DDR5 5600 SODIMM','kingston-fury-32gb-ddr5','ram',N'Kingston',N'RAM laptop DDR5 32GB',2450000,3190000,36,1),
 ('CRU-D4-16',      N'Crucial 16GB DDR4 3200 SODIMM',             'crucial-16gb-ddr4',      'ram',N'Crucial', N'RAM laptop DDR4 16GB',980000,1350000,36,1),
 ('WD-SN770-1TB',   N'WD Black SN770 1TB NVMe PCIe 4.0',          'wd-black-sn770-1tb',     'ssd',N'Western Digital',N'SSD NVMe PCIe 4.0 1TB',1900000,2490000,36,1),
 ('SAM-870EVO-1TB', N'Samsung 870 EVO 1TB SATA',                  'samsung-870-evo-1tb',    'ssd',N'Samsung', N'SSD SATA 2.5 inch 1TB',2000000,2590000,36,1),
 ('KIN-NV2-500',    N'Kingston NV2 500GB NVMe PCIe 4.0',          'kingston-nv2-500gb',     'ssd',N'Kingston',N'SSD NVMe PCIe 4.0 500GB',950000,1250000,36,1),
 ('RAZER-VIPER-V2', N'Chuột Razer Viper V2 Pro',                  'razer-viper-v2-pro',     'chuot',N'Razer', N'Chuột gaming không dây siêu nhẹ 58g',3100000,3990000,24,0),
 ('LOGI-M331',      N'Chuột Logitech M331 Silent',                'logitech-m331-silent',   'chuot',N'Logitech',N'Chuột không dây yên tĩnh',250000,359000,12,0),
 ('LOGI-G512',      N'Bàn phím cơ Logitech G512 Carbon',          'logitech-g512',          'ban-phim',N'Logitech',N'Bàn phím cơ RGB, switch GX',1750000,2290000,24,0),
 ('STEEL-APEX5',    N'Bàn phím cơ SteelSeries Apex 5',            'steelseries-apex-5',     'ban-phim',N'SteelSeries',N'Bàn phím cơ lai, đèn RGB',2100000,2790000,24,0),
 ('STEEL-ARCTIS5',  N'Tai nghe SteelSeries Arctis Nova 5',        'steelseries-arctis-nova-5','tai-nghe',N'SteelSeries',N'Tai nghe gaming không dây',3200000,4190000,12,0),
 ('LOGI-G435',      N'Tai nghe Logitech G435 Lightspeed',         'logitech-g435',          'tai-nghe',N'Logitech',N'Tai nghe không dây nhẹ',1200000,1590000,12,0),
 ('ASUS-TUF-BP',    N'Balo Asus TUF Gaming BP1500G',              'asus-tuf-bp1500g',       'balo',N'Asus',   N'Balo laptop 15.6 inch chống nước',600000,850000,12,0),
 ('BASEUS-65W',     N'Sạc Baseus GaN5 Pro 65W',                   'baseus-gan5-pro-65w',    'sac-cap',N'Baseus',N'Sạc nhanh 65W 2 cổng USB-C',550000,790000,18,0),
 ('ANKER-622',      N'Pin dự phòng Anker 622 MagGo 5000mAh',      'anker-622-maggo',        'sac-cap',N'Anker',N'Pin dự phòng từ tính',650000,899000,12,0)
) v(sku,n,slug,cat,brand,sd,cost,price,war,ser)
JOIN dbo.Categories c ON c.Slug = v.cat
JOIN dbo.Brands b ON b.BrandName = v.brand;

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, IsPrimary, SortOrder)
SELECT p.ProductId, '/images/placeholder.svg', 1, 0 FROM dbo.Products p
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.ProductId);

INSERT INTO dbo.ProductAttributeValues (ProductId, AttributeId, AttrValue)
SELECT p.ProductId, a.AttributeId, v.val FROM (VALUES
 ('KIN-FURY-D5-32','RAM_SIZE',N'32'),('KIN-FURY-D5-32','RAM_TYPE',N'DDR5'),
 ('CRU-D4-16','RAM_SIZE',N'16'),('CRU-D4-16','RAM_TYPE',N'DDR4'),
 ('WD-SN770-1TB','CAPACITY',N'1000'),('WD-SN770-1TB','SSD_INTERFACE',N'M.2 NVMe'),
 ('SAM-870EVO-1TB','CAPACITY',N'1000'),('SAM-870EVO-1TB','SSD_INTERFACE',N'SATA 2.5'),
 ('KIN-NV2-500','CAPACITY',N'500'),('KIN-NV2-500','SSD_INTERFACE',N'M.2 NVMe'),
 ('RAZER-VIPER-V2','CONNECTION',N'Không dây'),('RAZER-VIPER-V2','DPI',N'30000'),
 ('LOGI-M331','CONNECTION',N'Không dây'),('LOGI-M331','DPI',N'1000'),
 ('LOGI-G512','CONNECTION',N'Có dây'),('STEEL-APEX5','CONNECTION',N'Có dây'),
 ('STEEL-ARCTIS5','CONNECTION',N'Không dây'),('LOGI-G435','CONNECTION',N'Không dây')
) v(sku,code,val)
JOIN dbo.Products p ON p.Sku = v.sku JOIN dbo.Attributes a ON a.AttrCode = v.code;
GO

/* ---------- 6c. Nhập kho bổ sung (nhiều phiếu, nhiều nhà cung cấp, đủ trạng thái Nháp / Đã nhập / Đã huỷ) ---------- */
CREATE PROCEDURE #QuickReceipt
    @SupplierTax VARCHAR(20), @DaysAgo INT, @Note NVARCHAR(255),
    @Lines NVARCHAR(MAX),                 -- 'SKU:SL,SKU:SL,...'
    @Action VARCHAR(10) = 'Posted',       -- Posted (đã nhập kho) | Draft (nháp) | Cancelled (nháp đã huỷ)
    @PaidPct INT = 0                      -- % tiền hàng đã trả nhà cung cấp (chỉ phiếu Posted)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @emp INT, @acc INT, @sup INT, @n INT, @nStr VARCHAR(10), @g INT;
    SELECT @emp = EmployeeId, @acc = AccountId FROM dbo.Employees WHERE EmployeeCode = 'NV003';
    SELECT @sup = SupplierId FROM dbo.Suppliers WHERE TaxCode = @SupplierTax;

    SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo; SET @nStr = CAST(@n AS VARCHAR(10));
    INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
    VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT(REPLICATE('0',5)+@nStr, CASE WHEN LEN(@nStr)>5 THEN LEN(@nStr) ELSE 5 END),
            @sup, @emp, DATEADD(DAY, -@DaysAgo, SYSDATETIME()), @Note);
    SET @g = SCOPE_IDENTITY();

    INSERT INTO dbo.GoodsReceiptDetails (ReceiptId, ProductId, Quantity, UnitCost)
    SELECT @g, p.ProductId, CAST(SUBSTRING(s.value, CHARINDEX(':', s.value) + 1, 10) AS INT), p.CostPrice
    FROM STRING_SPLIT(@Lines, ',') s
    JOIN dbo.Products p ON p.Sku = LEFT(s.value, CHARINDEX(':', s.value) - 1);

    INSERT INTO dbo.ProductSerials (ProductId, SerialNumber, ReceiptDetailId, Status)
    SELECT d.ProductId,
           CONCAT(p.Sku, '-', RIGHT('000' + CAST(d.ReceiptDetailId AS VARCHAR(10)), 3), '-', RIGHT('000' + CAST(t.n AS VARCHAR(10)), 3)),
           d.ReceiptDetailId, 'Pending'
    FROM dbo.GoodsReceiptDetails d
    JOIN dbo.Products p ON p.ProductId = d.ProductId AND p.IsSerialTracked = 1
    JOIN (SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects) t ON t.n <= d.Quantity
    WHERE d.ReceiptId = @g;

    IF @Action = 'Posted'
    BEGIN
        EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g, @AccountId = @acc;
        UPDATE dbo.GoodsReceipts SET PaidAmount = CAST(ROUND(TotalAmount * @PaidPct / 100.0, 0) AS DECIMAL(18,0)) WHERE ReceiptId = @g;
    END
    ELSE IF @Action = 'Cancelled'
    BEGIN
        DELETE s FROM dbo.ProductSerials s JOIN dbo.GoodsReceiptDetails d ON d.ReceiptDetailId = s.ReceiptDetailId WHERE d.ReceiptId = @g AND s.Status = 'Pending';
        UPDATE dbo.GoodsReceipts SET Status = 'Cancelled' WHERE ReceiptId = @g;
    END
END
GO

--                  MST nhà cung cấp  Ngày trước  Ghi chú                                  Dòng hàng (SKU:SL)                                                                                                   Trạng thái  % đã trả
EXEC #QuickReceipt '0305678901', 90, N'Bổ sung chuột, bàn phím, cáp sạc',                  'LOGI-G102:10,ANKER-PL3:20,LOGI-K380:5',                                                                              'Posted',    100;
EXEC #QuickReceipt '0304567890', 70, N'Nhập RAM, SSD lô mới (tồn kho chênh lệch để demo)',  'KIN-FURY-D5-32:2,CRU-D4-16:12,WD-SN770-1TB:6,SAM-870EVO-1TB:1,KIN-NV2-500:20',                                       'Posted',    100;
EXEC #QuickReceipt '0301234567', 60, N'Bổ sung laptop bán chạy',                           'ASUS-TUF-F15:4,HP-15S:3',                                                                                            'Posted',    50;
EXEC #QuickReceipt '0303456789', 45, N'Nhập phụ kiện gaming lô mới',                       'RAZER-VIPER-V2:3,LOGI-M331:25,LOGI-G512:2,STEEL-APEX5:7,STEEL-ARCTIS5:1,LOGI-G435:9,ASUS-TUF-BP:14,BASEUS-65W:30',  'Posted',    60;
EXEC #QuickReceipt '0302345678', 20, N'Bổ sung RAM, SSD (chưa thanh toán)',                'KVR-D5-16:6,SAM-980-500:5,CRU-D5-8:4',                                                                               'Posted',    0;
EXEC #QuickReceipt '0302345678', 12, N'Phiếu nhập huỷ (nhập nhầm mã hàng)',                'MBA-M2:3',                                                                                                           'Cancelled', 0;
EXEC #QuickReceipt '0303456789', 6,  N'Bổ sung chuột, bàn phím cao cấp (chưa thanh toán)', 'LOGI-MXM3S:5,CORSAIR-K70:4',                                                                                  'Posted',    0;
EXEC #QuickReceipt '0301234567', 1,  N'Phiếu nháp - chờ kiểm đếm và chốt',                 'MSI-KATANA-15:5,DELL-XPS-15:2',                                                                                      'Draft',     0;
GO
DROP PROCEDURE #QuickReceipt;
GO

/* ---------- 7. Đơn hàng mẫu (qua Stored Procedure -> đúng nghiệp vụ) ---------- */
-- @Action: Pending (chờ kiểm tra / chờ thanh toán) | PaidPending (đã thanh toán, chờ nhân viên kiểm tra hàng) | Approved |
--          Completed | Cancelled | ApprovedCancelled | Refunding (đã thanh toán rồi huỷ -> chờ hoàn tiền) | Refunded (đã hoàn tiền)
-- Đơn chuyển khoản / Stripe chỉ được duyệt khi đã thanh toán, nên thủ tục tự ghi nhận thanh toán trước khi duyệt.
-- Một đơn lỗi (vd hết hàng) chỉ in cảnh báo, không làm hỏng cả file seed.
CREATE PROCEDURE #QuickOrder
    @Phone VARCHAR(15), @Sku1 VARCHAR(40), @Qty1 INT, @Sku2 VARCHAR(40) = NULL, @Qty2 INT = 1,
    @Promo VARCHAR(30) = NULL, @Action VARCHAR(20) = 'Pending', @DaysAgo INT = 0, @Method VARCHAR(15) = 'COD',
    @Note NVARCHAR(500) = N'Đơn dữ liệu mẫu'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustId INT, @CartId INT, @Addr INT, @OrderId INT, @Acc INT, @Ref VARCHAR(100);
    BEGIN TRY
        SELECT @CustId = CustomerId FROM dbo.Customers WHERE Phone = @Phone;
        SELECT @CartId = CartId FROM dbo.Carts WHERE CustomerId = @CustId;
        IF @CartId IS NULL
        BEGIN
            INSERT INTO dbo.Carts (CustomerId) VALUES (@CustId);
            SET @CartId = SCOPE_IDENTITY();
        END
        DELETE FROM dbo.CartItems WHERE CartId = @CartId;
        INSERT INTO dbo.CartItems (CartId, ProductId, Quantity) SELECT @CartId, ProductId, @Qty1 FROM dbo.Products WHERE Sku = @Sku1;
        IF @Sku2 IS NOT NULL
            INSERT INTO dbo.CartItems (CartId, ProductId, Quantity) SELECT @CartId, ProductId, @Qty2 FROM dbo.Products WHERE Sku = @Sku2;

        SELECT TOP 1 @Addr = AddressId FROM dbo.CustomerAddresses WHERE CustomerId = @CustId ORDER BY IsDefault DESC;
        EXEC dbo.sp_PlaceOrderFromCart @CustomerId = @CustId, @AddressId = @Addr, @PaymentMethod = @Method,
                                       @PromoCode = @Promo, @Note = @Note, @OrderId = @OrderId OUTPUT;

        SELECT @Acc = AccountId FROM dbo.Employees WHERE EmployeeCode = 'NV001';

        -- Thanh toán trước khi duyệt / hoàn tất
        IF (@Method IN ('BankTransfer', 'Stripe') AND @Action IN ('PaidPending', 'Approved', 'Completed', 'Refunding', 'Refunded'))
           OR (@Method IN ('Installment', 'Card') AND @Action IN ('Completed', 'Refunding', 'Refunded'))
        BEGIN
            IF @Method = 'Stripe'
            BEGIN
                SET @Ref = CONCAT('pi_seed_', @OrderId);
                EXEC dbo.sp_MarkPaidByGateway @OrderId = @OrderId, @GatewayRef = @Ref;
            END
            ELSE
                EXEC dbo.sp_ConfirmPayment @OrderId = @OrderId, @AccountId = @Acc;
        END

        -- Stripe: đơn 1 sản phẩm đã được hệ thống tự duyệt ngay khi thanh toán, nên chỉ duyệt nếu còn Pending
        IF @Action IN ('Approved', 'Completed', 'ApprovedCancelled', 'Refunding', 'Refunded')
           AND (SELECT Status FROM dbo.Orders WHERE OrderId = @OrderId) = 'Pending'
            EXEC dbo.sp_ApproveOrder @OrderId = @OrderId, @AccountId = @Acc;
        -- Dùng sp_CompleteOrder (không UPDATE Status trực tiếp) để đơn mẫu cũng đi qua đúng
        -- nghiệp vụ: cộng điểm thành viên, nâng hạng, và chỉ cho hoàn tất khi đã thanh toán (hoặc COD).
        IF @Action = 'Completed' EXEC dbo.sp_CompleteOrder @OrderId = @OrderId, @AccountId = @Acc;
        IF @Action IN ('Cancelled', 'ApprovedCancelled', 'Refunding', 'Refunded')
            EXEC dbo.sp_CancelOrder @OrderId = @OrderId, @Reason = N'Khách đổi ý (dữ liệu mẫu)', @AccountId = @Acc;
        IF @Action = 'Refunded' EXEC dbo.sp_ConfirmRefund @OrderId = @OrderId, @AccountId = @Acc;

        -- Lùi ngày để báo cáo theo thời gian có dữ liệu
        UPDATE dbo.Orders SET CreatedAt = DATEADD(DAY, -@DaysAgo, CreatedAt), ApprovedAt = DATEADD(DAY, -@DaysAgo, ApprovedAt),
                              CompletedAt = DATEADD(DAY, -@DaysAgo, CompletedAt), CancelledAt = DATEADD(DAY, -@DaysAgo, CancelledAt),
                              PaidAt = DATEADD(DAY, -@DaysAgo, PaidAt)
        WHERE OrderId = @OrderId;
        UPDATE dbo.Invoices SET IssuedAt = DATEADD(DAY, -@DaysAgo, IssuedAt) WHERE OrderId = @OrderId;
        UPDATE w SET w.StartDate = DATEADD(DAY, -@DaysAgo, w.StartDate), w.EndDate = DATEADD(DAY, -@DaysAgo, w.EndDate)
        FROM dbo.Warranties w JOIN dbo.OrderDetails d ON d.OrderDetailId = w.OrderDetailId WHERE d.OrderId = @OrderId;
    END TRY
    BEGIN CATCH
        PRINT CONCAT(N'[seed] Bỏ qua đơn ', @Phone, N' / ', @Sku1, N' / ', @Action, N': ', ERROR_MESSAGE());
    END CATCH
END
GO

DECLARE @inst NVARCHAR(500) = N'[TRẢ GÓP] 12 tháng · trả trước 30% · Thẻ tín dụng (0%) | Đơn dữ liệu mẫu';

--                 SĐT khách     SP1              SL  SP2            SL  Voucher      Trạng thái          Ngày trước  Thanh toán
EXEC #QuickOrder '0912000001', 'ASUS-TUF-F15',  1, 'KVR-D5-16',    1, 'WELCOME10', 'Completed',         20;
EXEC #QuickOrder '0912000002', 'DELL-INS-15',   1, 'LOGI-G102',    1, NULL,        'Completed',         15;
EXEC #QuickOrder '0912000003', 'MBA-M2',        1, NULL,           1, NULL,        'Approved',           9;
EXEC #QuickOrder '0912000001', 'LOGI-MXM3S',    1, 'LOGI-K380',    1, NULL,        'Completed',         12;
EXEC #QuickOrder '0912000002', 'LENOVO-LOQ-15', 1, NULL,           1, NULL,        'ApprovedCancelled',  7;
EXEC #QuickOrder '0912000003', 'HP-15S',        1, NULL,           1, NULL,        'Cancelled',          5;
EXEC #QuickOrder '0912000002', 'RAZER-DAV3',    2, NULL,           1, NULL,        'Approved',           3;
EXEC #QuickOrder '0912000001', 'ASUS-VIVO-PRO', 1, NULL,           1, 'GIAM500K',  'Approved',           2;
EXEC #QuickOrder '0912000001', 'SAM-980P-1TB',  1, 'LOGI-MXM3S',   1, NULL,        'Pending',            1;
EXEC #QuickOrder '0912000003', 'LENOVO-IDEA5',  1, 'ANKER-737',    1, NULL,        'Pending',            0;

-- Đơn bổ sung rải đều ~3 tháng, đủ phương thức thanh toán và trạng thái (đã giao / đang xử lý / huỷ / hoàn tiền)
EXEC #QuickOrder '0912000004', 'HP-15S',        1, 'LOGI-G102',    1, NULL,        'Completed',         84, 'COD';
EXEC #QuickOrder '0912000005', 'DELL-INS-15',   1, NULL,           1, NULL,        'Completed',         80, 'BankTransfer';
EXEC #QuickOrder '0912000006', 'ASUS-TUF-F15',  1, 'ANKER-737',    1, 'WELCOME10', 'Completed',         76, 'Stripe';
EXEC #QuickOrder '0912000007', 'LENOVO-IDEA5',  1, NULL,           1, NULL,        'Completed',         72, 'Installment', @inst;
EXEC #QuickOrder '0912000008', 'MSI-KATANA-15', 1, 'RAZER-BSV2X',  1, NULL,        'Completed',         68, 'COD';
EXEC #QuickOrder '0912000009', 'LENOVO-LOQ-15', 1, NULL,           1, NULL,        'Completed',         63, 'BankTransfer';
EXEC #QuickOrder '0912000010', 'HP-15S',        1, 'KIN-A400-480', 1, NULL,        'Completed',         58, 'COD';
EXEC #QuickOrder '0912000004', 'LOGI-K380',     1, 'ANKER-PL3',    2, NULL,        'Completed',         55, 'COD';
EXEC #QuickOrder '0912000005', 'MSI-KATANA-15', 1, NULL,           1, 'LAPTOP5',   'Completed',         50, 'Stripe';
EXEC #QuickOrder '0912000006', 'DELL-INS-15',   1, 'KVR-D4-8',     1, 'BTS2026',   'Completed',         46, 'BankTransfer';
EXEC #QuickOrder '0912000007', 'ASUS-TUF-F15',  1, NULL,           1, NULL,        'Completed',         41, 'COD';
EXEC #QuickOrder '0912000008', 'MBA-M2',        1, NULL,           1, NULL,        'Completed',         37, 'Installment', @inst;
EXEC #QuickOrder '0912000009', 'CORSAIR-K70',   1, 'LOGI-MXM3S',   1, 'SAVE200K',  'Completed',         33, 'BankTransfer';
EXEC #QuickOrder '0912000010', 'LENOVO-LOQ-15', 1, 'ASUS-ROG-BP',  1, NULL,        'Completed',         29, 'Stripe';
EXEC #QuickOrder '0912000004', 'HP-15S',        1, NULL,           1, NULL,        'Refunded',          26, 'BankTransfer';
EXEC #QuickOrder '0912000005', 'LENOVO-IDEA5',  1, NULL,           1, NULL,        'Refunding',         22, 'Stripe';
EXEC #QuickOrder '0912000006', 'DELL-XPS-15',   1, 'SAM-980P-1TB', 1, NULL,        'Completed',         18, 'COD';
EXEC #QuickOrder '0912000007', 'SAM-980-500',   1, 'KVR-D5-16',    1, NULL,        'Completed',         16, 'BankTransfer';
EXEC #QuickOrder '0912000004', 'LENOVO-LOQ-15', 1, NULL,           1, NULL,        'ApprovedCancelled', 14, 'COD';
EXEC #QuickOrder '0912000008', 'ASUS-TUF-F15',  1, 'CRU-D5-8',     1, NULL,        'Approved',          11, 'BankTransfer';
EXEC #QuickOrder '0912000005', 'HP-15S',        1, 'RAZER-DAV3',   1, NULL,        'Cancelled',         10, 'COD';
EXEC #QuickOrder '0912000009', 'MSI-KATANA-15', 1, NULL,           1, NULL,        'Approved',           8, 'Stripe';
EXEC #QuickOrder '0912000010', 'DELL-INS-15',   1, 'LOGI-G102',    2, NULL,        'Approved',           6, 'Installment', @inst;
EXEC #QuickOrder '0912000006', 'LENOVO-IDEA5',  1, 'ANKER-737',    1, NULL,        'PaidPending',        2, 'BankTransfer';
EXEC #QuickOrder '0912000007', 'MSI-KATANA-15', 1, 'ANKER-PL3',    1, NULL,        'Pending',            1, 'BankTransfer';
EXEC #QuickOrder '0912000008', 'ASUS-TUF-F15',  1, 'LOGI-K380',    1, NULL,        'Pending',            1, 'Stripe';
EXEC #QuickOrder '0912000009', 'DELL-INS-15',   1, 'KIN-A400-480', 1, NULL,        'Pending',            0, 'COD';
EXEC #QuickOrder '0912000010', 'HP-15S',        2, NULL,           1, NULL,        'Pending',            0, 'COD';
GO
DROP PROCEDURE #QuickOrder;
GO

-- Hạng thành viên: một vài khách có điểm tích luỹ cao để màn hình khách hàng / báo cáo có đủ các hạng
UPDATE c SET c.LoyaltyPoints = v.pts, c.TierId = t.TierId
FROM dbo.Customers c
JOIN (VALUES ('0912000002', 5400, N'Vàng'), ('0912000007', 10800, N'Kim cương'), ('0912000005', 1250, N'Bạc'), ('0912000009', 1030, N'Bạc')) v(ph, pts, tier) ON v.ph = c.Phone
JOIN dbo.MembershipTiers t ON t.TierName = v.tier;
GO

/* ---------- 8. Nhật ký mẫu ---------- */
INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail, IpAddress)
SELECT a.AccountId, v.act, v.ent, v.eid, v.d, '127.0.0.1' FROM (VALUES
 ('admin','LOGIN',NULL,NULL,N'Đăng nhập trang quản trị'),
 ('admin','CREATE','Account','2',N'Tạo tài khoản sales1'),
 ('sales1','APPROVE','Order','1',N'Duyệt đơn hàng đầu tiên'),
 ('kho1','POST','GoodsReceipt','1',N'Chốt phiếu nhập kho')) v(u,act,ent,eid,d)
JOIN dbo.Accounts a ON a.Username = v.u;
GO

-- Kiểm tra nhanh
SELECT 'Products' AS [Table], COUNT(*) AS Total FROM dbo.Products UNION ALL
SELECT 'ProductSerials', COUNT(*) FROM dbo.ProductSerials UNION ALL
SELECT 'Orders', COUNT(*) FROM dbo.Orders UNION ALL
SELECT 'Invoices', COUNT(*) FROM dbo.Invoices UNION ALL
SELECT 'Warranties', COUNT(*) FROM dbo.Warranties;
GO

/* ---------- 8. Cấp quyền cho login ứng dụng (nếu có) ----------
   01_schema.sql DROP DATABASE nên mất user của login 'laptopshop_app' (gây lỗi "Login failed" khi chạy app).
   Đoạn này tự tạo lại user + quyền tối thiểu (đọc/ghi dữ liệu + chạy stored procedure) NẾU login đó tồn tại.
   Dùng login khác (vd 'sa' hoặc tài khoản Windows) thì bỏ qua đoạn này. */
IF SUSER_ID(N'laptopshop_app') IS NOT NULL AND DATABASE_PRINCIPAL_ID(N'laptopshop_app') IS NULL
BEGIN
    CREATE USER [laptopshop_app] FOR LOGIN [laptopshop_app];
    ALTER ROLE db_datareader ADD MEMBER [laptopshop_app];
    ALTER ROLE db_datawriter ADD MEMBER [laptopshop_app];
    GRANT EXECUTE TO [laptopshop_app];
END
GO