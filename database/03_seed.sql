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
 ('shop.buy',        N'Mua hàng',               N'Cửa hàng');

INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, p.PermissionId FROM dbo.Roles r JOIN dbo.Permissions p ON
   (r.RoleCode='ADMIN'     AND p.PermCode IN ('dashboard.admin','user.manage','role.manage','audit.view'))
OR (r.RoleCode='SALES'     AND p.PermCode IN ('product.view','product.create','product.update','product.delete','category.manage','brand.manage',
                                              'order.view','order.approve','order.cancel','invoice.view','invoice.print','report.view','warranty.view','stock.view'))
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
 ('RAM_TYPE',N'Chuẩn RAM',NULL,1),('RAM_SLOTS',N'Số khe RAM',NULL,0),('STORAGE',N'Ổ cứng',NULL,0),
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

-- Thuộc tính kỹ thuật (Sku, mã thuộc tính, giá trị)
INSERT INTO dbo.ProductAttributeValues (ProductId, AttributeId, AttrValue)
SELECT p.ProductId, a.AttributeId, v.val FROM (VALUES
 ('ASUS-TUF-F15','CPU',N'Intel Core i5-12500H'),('ASUS-TUF-F15','GPU',N'NVIDIA RTX 3050 4GB'),('ASUS-TUF-F15','RAM_SIZE',N'8'),('ASUS-TUF-F15','RAM_TYPE',N'DDR5'),('ASUS-TUF-F15','RAM_SLOTS',N'2 khe (1 trống)'),('ASUS-TUF-F15','STORAGE',N'512GB NVMe'),('ASUS-TUF-F15','SSD_INTERFACE',N'M.2 NVMe'),('ASUS-TUF-F15','SCREEN',N'15.6'),('ASUS-TUF-F15','REFRESH_RATE',N'144'),('ASUS-TUF-F15','WEIGHT',N'2.2'),
 ('MSI-KATANA-15','CPU',N'Intel Core i7-13620H'),('MSI-KATANA-15','GPU',N'NVIDIA RTX 4050 6GB'),('MSI-KATANA-15','RAM_SIZE',N'16'),('MSI-KATANA-15','RAM_TYPE',N'DDR5'),('MSI-KATANA-15','RAM_SLOTS',N'2 khe (0 trống)'),('MSI-KATANA-15','STORAGE',N'1TB NVMe'),('MSI-KATANA-15','SSD_INTERFACE',N'M.2 NVMe'),('MSI-KATANA-15','SCREEN',N'15.6'),('MSI-KATANA-15','REFRESH_RATE',N'144'),('MSI-KATANA-15','WEIGHT',N'2.25'),
 ('LENOVO-LOQ-15','CPU',N'Intel Core i5-12450HX'),('LENOVO-LOQ-15','GPU',N'NVIDIA RTX 3050 6GB'),('LENOVO-LOQ-15','RAM_SIZE',N'12'),('LENOVO-LOQ-15','RAM_TYPE',N'DDR5'),('LENOVO-LOQ-15','RAM_SLOTS',N'2 khe (0 trống)'),('LENOVO-LOQ-15','STORAGE',N'512GB NVMe'),('LENOVO-LOQ-15','SSD_INTERFACE',N'M.2 NVMe'),('LENOVO-LOQ-15','SCREEN',N'15.6'),('LENOVO-LOQ-15','REFRESH_RATE',N'144'),('LENOVO-LOQ-15','WEIGHT',N'2.38'),
 ('DELL-INS-15','CPU',N'Intel Core i5-1235U'),('DELL-INS-15','RAM_SIZE',N'8'),('DELL-INS-15','RAM_TYPE',N'DDR4'),('DELL-INS-15','RAM_SLOTS',N'2 khe (1 trống)'),('DELL-INS-15','STORAGE',N'512GB NVMe'),('DELL-INS-15','SSD_INTERFACE',N'M.2 NVMe'),('DELL-INS-15','SCREEN',N'15.6'),('DELL-INS-15','WEIGHT',N'1.65'),
 ('HP-15S','CPU',N'Intel Core i5-1235U'),('HP-15S','RAM_SIZE',N'8'),('HP-15S','RAM_TYPE',N'DDR4'),('HP-15S','RAM_SLOTS',N'2 khe (1 trống)'),('HP-15S','STORAGE',N'512GB NVMe'),('HP-15S','SSD_INTERFACE',N'M.2 NVMe'),('HP-15S','SCREEN',N'15.6'),('HP-15S','WEIGHT',N'1.69'),
 ('LENOVO-IDEA5','CPU',N'Intel Core i5-12450H'),('LENOVO-IDEA5','RAM_SIZE',N'16'),('LENOVO-IDEA5','RAM_TYPE',N'DDR5'),('LENOVO-IDEA5','RAM_SLOTS',N'Onboard (không nâng cấp)'),('LENOVO-IDEA5','STORAGE',N'512GB NVMe'),('LENOVO-IDEA5','SSD_INTERFACE',N'M.2 NVMe'),('LENOVO-IDEA5','SCREEN',N'14'),('LENOVO-IDEA5','WEIGHT',N'1.46'),
 ('MBA-M2','CPU',N'Apple M2 8 nhân'),('MBA-M2','RAM_SIZE',N'8'),('MBA-M2','STORAGE',N'256GB SSD'),('MBA-M2','SCREEN',N'13.6'),('MBA-M2','WEIGHT',N'1.24'),
 ('ASUS-VIVO-PRO','CPU',N'AMD Ryzen 7 7735HS'),('ASUS-VIVO-PRO','GPU',N'NVIDIA RTX 3050 4GB'),('ASUS-VIVO-PRO','RAM_SIZE',N'16'),('ASUS-VIVO-PRO','RAM_TYPE',N'DDR5'),('ASUS-VIVO-PRO','RAM_SLOTS',N'2 khe (0 trống)'),('ASUS-VIVO-PRO','STORAGE',N'1TB NVMe'),('ASUS-VIVO-PRO','SSD_INTERFACE',N'M.2 NVMe'),('ASUS-VIVO-PRO','SCREEN',N'15.6 OLED'),('ASUS-VIVO-PRO','WEIGHT',N'1.8'),
 ('DELL-XPS-15','CPU',N'Intel Core i7-13700H'),('DELL-XPS-15','GPU',N'NVIDIA RTX 4050 6GB'),('DELL-XPS-15','RAM_SIZE',N'16'),('DELL-XPS-15','RAM_TYPE',N'DDR5'),('DELL-XPS-15','RAM_SLOTS',N'2 khe (0 trống)'),('DELL-XPS-15','STORAGE',N'512GB NVMe'),('DELL-XPS-15','SSD_INTERFACE',N'M.2 NVMe'),('DELL-XPS-15','SCREEN',N'15.6 OLED 3.5K'),('DELL-XPS-15','WEIGHT',N'1.86'),
 ('KVR-D4-8','RAM_SIZE',N'8'),('KVR-D4-8','RAM_TYPE',N'DDR4'),('KVR-D5-16','RAM_SIZE',N'16'),('KVR-D5-16','RAM_TYPE',N'DDR5'),('CRU-D5-8','RAM_SIZE',N'8'),('CRU-D5-8','RAM_TYPE',N'DDR5'),
 ('SAM-980-500','CAPACITY',N'500'),('SAM-980-500','SSD_INTERFACE',N'M.2 NVMe'),('SAM-980P-1TB','CAPACITY',N'1000'),('SAM-980P-1TB','SSD_INTERFACE',N'M.2 NVMe'),('KIN-A400-480','CAPACITY',N'480'),('KIN-A400-480','SSD_INTERFACE',N'SATA 2.5'),
 ('LOGI-G102','CONNECTION',N'Có dây'),('LOGI-G102','DPI',N'8000'),('LOGI-MXM3S','CONNECTION',N'Không dây'),('LOGI-MXM3S','DPI',N'8000'),('RAZER-DAV3','CONNECTION',N'Có dây'),('RAZER-DAV3','DPI',N'30000'),
 ('CORSAIR-K70','CONNECTION',N'Có dây'),('LOGI-K380','CONNECTION',N'Không dây'),('RAZER-BSV2X','CONNECTION',N'Có dây')
) v(sku,code,val)
JOIN dbo.Products p ON p.Sku = v.sku JOIN dbo.Attributes a ON a.AttrCode = v.code;

-- Luật tương thích: RAM phải cùng chuẩn RAM_TYPE, SSD phải cùng chuẩn SSD_INTERFACE với laptop (MainCategory có thể là danh mục cha)
INSERT INTO dbo.CompatibilityRules (MainCategoryId, ComponentCategoryId, AttributeId, Description)
SELECT m.CategoryId, c.CategoryId, a.AttributeId, v.d FROM (VALUES
 ('laptop','ram','RAM_TYPE',N'RAM phải cùng chuẩn (DDR4/DDR5) với laptop'),
 ('laptop','ssd','SSD_INTERFACE',N'SSD phải cùng chuẩn giao tiếp (M.2 NVMe / SATA) với laptop')) v(m,c,a,d)
JOIN dbo.Categories m ON m.Slug = v.m JOIN dbo.Categories c ON c.Slug = v.c JOIN dbo.Attributes a ON a.AttrCode = v.a;

/* ---------- 5. Nhà cung cấp / khuyến mãi ---------- */
INSERT INTO dbo.Suppliers (SupplierName, TaxCode, ContactName, Phone, Email, Address, PaymentTermDays) VALUES
 (N'Công ty CP FPT Synnex',  '0301234567', N'Nguyễn Hữu Phước','0281111111','sales@synnex.vn', N'Quận 7, TP.HCM', 30),
 (N'Công ty CP Digiworld (DGW)','0302345678', N'Trần Quốc Bảo', '0282222222','sales@dgw.vn',   N'Quận 3, TP.HCM', 45),
 (N'Công ty Viễn Sơn',        '0303456789', N'Lê Thanh Sơn',   '0283333333','sales@vienson.vn',N'Quận 10, TP.HCM', 15);

INSERT INTO dbo.Promotions (Code, PromoName, DiscountType, DiscountValue, MinOrderAmount, MaxDiscount, StartDate, EndDate, UsageLimit) VALUES
 ('WELCOME10', N'Chào bạn mới - giảm 10%',        'Percent', 10, 5000000, 1000000, DATEADD(MONTH,-2,SYSDATETIME()), DATEADD(MONTH,6,SYSDATETIME()), 100),
 ('GIAM500K',  N'Giảm 500.000đ cho đơn từ 10 triệu','Amount', 500000, 10000000, NULL, DATEADD(MONTH,-1,SYSDATETIME()), DATEADD(MONTH,3,SYSDATETIME()), 50),
 ('TET2026',   N'Khuyến mãi Tết (đã hết hạn)',     'Percent', 15, 0, 2000000, '2026-01-10', '2026-02-20', NULL);

/* ---------- 6. Nhập kho (3 phiếu, có serial) ---------- */
DECLARE @emp INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV003');
DECLARE @s1 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0301234567');
DECLARE @s2 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0302345678');
DECLARE @s3 INT = (SELECT SupplierId FROM dbo.Suppliers WHERE TaxCode = '0303456789');
DECLARE @d DATETIME2(0) = DATEADD(DAY,-30,SYSDATETIME());
DECLARE @g1 INT, @g2 INT, @g3 INT, @n INT;

SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo;
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT('00000'+CAST(@n AS VARCHAR(10)),5), @s1, @emp, @d, N'Nhập laptop lô đầu');
SET @g1 = SCOPE_IDENTITY();
SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo;
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT('00000'+CAST(@n AS VARCHAR(10)),5), @s2, @emp, @d, N'Nhập laptop đồ hoạ, RAM, SSD');
SET @g2 = SCOPE_IDENTITY();
SELECT @n = NEXT VALUE FOR dbo.sq_ReceiptNo;
INSERT INTO dbo.GoodsReceipts (ReceiptNo, SupplierId, EmployeeId, ReceiptDate, Note)
VALUES ('PN' + FORMAT(SYSDATETIME(),'yyMM') + '-' + RIGHT('00000'+CAST(@n AS VARCHAR(10)),5), @s3, @emp, @d, N'Nhập phụ kiện');
SET @g3 = SCOPE_IDENTITY();

INSERT INTO dbo.GoodsReceiptDetails (ReceiptId, ProductId, Quantity, UnitCost)
SELECT CASE v.g WHEN 1 THEN @g1 WHEN 2 THEN @g2 ELSE @g3 END, p.ProductId, v.qty, p.CostPrice FROM (VALUES
 (1,'ASUS-TUF-F15',6),(1,'MSI-KATANA-15',5),(1,'LENOVO-LOQ-15',6),(1,'DELL-INS-15',8),(1,'HP-15S',8),(1,'LENOVO-IDEA5',6),(1,'MBA-M2',5),
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

EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g1;
EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g2;
EXEC dbo.sp_PostGoodsReceipt @ReceiptId = @g3;
-- Nhà cung cấp đã thanh toán một phần
UPDATE dbo.GoodsReceipts SET PaidAmount = TotalAmount WHERE ReceiptId = @g1;
UPDATE dbo.GoodsReceipts SET PaidAmount = TotalAmount / 2 WHERE ReceiptId = @g2;
UPDATE dbo.GoodsReceipts SET DueDate = DATEADD(DAY, 15, CAST(ReceiptDate AS DATE)) WHERE ReceiptId = @g3;
-- Sắp hết hàng để demo cảnh báo (ReorderLevel cao hơn tồn)
UPDATE dbo.Products SET ReorderLevel = 4 WHERE Sku IN ('DELL-XPS-15','MBA-M2','ASUS-VIVO-PRO');
GO

/* ---------- 7. Đơn hàng mẫu (qua Stored Procedure -> đúng nghiệp vụ) ---------- */
CREATE PROCEDURE #QuickOrder
    @Phone VARCHAR(15), @Sku1 VARCHAR(40), @Qty1 INT, @Sku2 VARCHAR(40) = NULL, @Qty2 INT = 1,
    @Promo VARCHAR(30) = NULL, @Action VARCHAR(20) = 'Pending', @DaysAgo INT = 0, @Method VARCHAR(15) = 'COD'
AS
BEGIN
    DECLARE @CustId INT, @CartId INT, @Addr INT, @OrderId INT, @Acc INT;
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
                                   @PromoCode = @Promo, @Note = N'Đơn dữ liệu mẫu', @OrderId = @OrderId OUTPUT;

    SELECT @Acc = AccountId FROM dbo.Employees WHERE EmployeeCode = 'NV001';
    IF @Action IN ('Approved','Completed','ApprovedCancelled') EXEC dbo.sp_ApproveOrder @OrderId = @OrderId, @AccountId = @Acc;
    IF @Action = 'Completed'
    BEGIN
        UPDATE dbo.Orders SET Status = 'Completed', CompletedAt = SYSDATETIME(), PaymentStatus = 'Paid', PaidAt = SYSDATETIME()
        WHERE OrderId = @OrderId;
        INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
        VALUES (@Acc, 'COMPLETE', 'Order', CAST(@OrderId AS VARCHAR(50)), N'Giao hàng thành công (Approved -> Completed)');
    END
    IF @Action IN ('Cancelled','ApprovedCancelled')
        EXEC dbo.sp_CancelOrder @OrderId = @OrderId, @Reason = N'Khách đổi ý (dữ liệu mẫu)', @AccountId = @Acc;

    -- Lùi ngày để báo cáo theo thời gian có dữ liệu
    UPDATE dbo.Orders SET CreatedAt = DATEADD(DAY, -@DaysAgo, CreatedAt), ApprovedAt = DATEADD(DAY, -@DaysAgo, ApprovedAt),
                          CompletedAt = DATEADD(DAY, -@DaysAgo, CompletedAt), CancelledAt = DATEADD(DAY, -@DaysAgo, CancelledAt),
                          PaidAt = DATEADD(DAY, -@DaysAgo, PaidAt)
    WHERE OrderId = @OrderId;
    UPDATE dbo.Invoices SET IssuedAt = DATEADD(DAY, -@DaysAgo, IssuedAt) WHERE OrderId = @OrderId;
    UPDATE w SET w.StartDate = DATEADD(DAY, -@DaysAgo, w.StartDate), w.EndDate = DATEADD(DAY, -@DaysAgo, w.EndDate)
    FROM dbo.Warranties w JOIN dbo.OrderDetails d ON d.OrderDetailId = w.OrderDetailId WHERE d.OrderId = @OrderId;
END
GO

--                 SĐT khách     SP1              SL  SP2            SL  Voucher      Trạng thái          Ngày trước
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
GO
DROP PROCEDURE #QuickOrder;
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
