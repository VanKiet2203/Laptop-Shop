/* =====================================================================
   HỆ THỐNG QUẢN LÝ BÁN LAPTOP & LINH KIỆN / PHỤ KIỆN  -  SQL Server
   File 01: TẠO CƠ SỞ DỮ LIỆU + BẢNG + RÀNG BUỘC + INDEX
   CẢNH BÁO: script này XOÁ và tạo lại database LaptopShopDB (dùng khi dev).
   Quy ước:
     - Khoá chính  : <Tên bảng số ít>Id  (INT/BIGINT IDENTITY)
     - Tiền tệ     : DECIMAL(18,0) (VND)
     - Thời gian   : DATETIME2(0)
     - Mỗi cột có comment "-- mô tả" ở cuối dòng -> script tools/gen_dictionary.py
       dùng để sinh từ điển dữ liệu (docs/DATABASE_DICTIONARY.md).
   ===================================================================== */
USE master;
GO
IF DB_ID(N'LaptopShopDB') IS NOT NULL
BEGIN
    ALTER DATABASE LaptopShopDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE LaptopShopDB;
END
GO
CREATE DATABASE LaptopShopDB;
GO
USE LaptopShopDB;
GO

/* ---------- SEQUENCE sinh số chứng từ ---------- */
CREATE SEQUENCE dbo.sq_OrderNo   AS INT START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dbo.sq_InvoiceNo AS INT START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dbo.sq_ReceiptNo AS INT START WITH 1 INCREMENT BY 1;
GO

/* =====================================================================
   NHÓM 1: PHÂN QUYỀN - TÀI KHOẢN - NGƯỜI DÙNG   (Module 1)
   ===================================================================== */

-- [Table] Roles: Vai trò trong hệ thống (ADMIN, SALES, WAREHOUSE, CUSTOMER)
CREATE TABLE dbo.Roles (
    RoleId          INT IDENTITY(1,1) NOT NULL,   -- Mã vai trò
    RoleCode        VARCHAR(30)   NOT NULL,       -- Mã code vai trò (ADMIN, SALES...)
    RoleName        NVARCHAR(100) NOT NULL,       -- Tên hiển thị
    Description     NVARCHAR(255) NULL,           -- Mô tả
    CONSTRAINT PK_Roles PRIMARY KEY (RoleId),
    CONSTRAINT UQ_Roles_Code UNIQUE (RoleCode)
);

-- [Table] Permissions: Danh mục quyền chi tiết (vd product.create, order.approve)
CREATE TABLE dbo.Permissions (
    PermissionId    INT IDENTITY(1,1) NOT NULL,   -- Mã quyền
    PermCode        VARCHAR(60)   NOT NULL,       -- Mã quyền dạng module.action
    PermName        NVARCHAR(150) NOT NULL,       -- Tên quyền
    ModuleName      NVARCHAR(50)  NOT NULL,       -- Nhóm chức năng
    CONSTRAINT PK_Permissions PRIMARY KEY (PermissionId),
    CONSTRAINT UQ_Permissions_Code UNIQUE (PermCode)
);

-- [Table] RolePermissions: Gán quyền cho vai trò (N-N)
CREATE TABLE dbo.RolePermissions (
    RoleId          INT NOT NULL,                 -- Vai trò
    PermissionId    INT NOT NULL,                 -- Quyền
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePerm_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE CASCADE,
    CONSTRAINT FK_RolePerm_Perm FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId) ON DELETE CASCADE
);

-- [Table] Accounts: Tài khoản đăng nhập dùng chung (nhân viên, admin, khách hàng)
CREATE TABLE dbo.Accounts (
    AccountId       INT IDENTITY(1,1) NOT NULL,   -- Mã tài khoản
    Username        VARCHAR(50)   NOT NULL,       -- Tên đăng nhập (duy nhất)
    Email           VARCHAR(150)  NULL,           -- Email (duy nhất nếu có)
    PasswordHash    VARCHAR(100)  NOT NULL,       -- Mật khẩu đã băm bcrypt
    RoleId          INT           NOT NULL,       -- Vai trò
    IsActive        BIT           NOT NULL CONSTRAINT DF_Accounts_Active DEFAULT 1, -- 1 = hoạt động, 0 = khoá
    LastLoginAt     DATETIME2(0)  NULL,           -- Lần đăng nhập gần nhất
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Accounts_Created DEFAULT SYSDATETIME(), -- Ngày tạo
    CONSTRAINT PK_Accounts PRIMARY KEY (AccountId),
    CONSTRAINT UQ_Accounts_Username UNIQUE (Username),
    CONSTRAINT FK_Accounts_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
);
CREATE UNIQUE INDEX UX_Accounts_Email ON dbo.Accounts(Email) WHERE Email IS NOT NULL;

-- [Table] Employees: Hồ sơ nhân viên (quan hệ 1-1 với Accounts)
CREATE TABLE dbo.Employees (
    EmployeeId      INT IDENTITY(1,1) NOT NULL,   -- Mã nhân viên (khoá)
    AccountId       INT           NOT NULL,       -- Tài khoản đăng nhập
    EmployeeCode    VARCHAR(20)   NOT NULL,       -- Mã nhân viên hiển thị (NV001)
    FullName        NVARCHAR(100) NOT NULL,       -- Họ tên
    Phone           VARCHAR(15)   NULL,           -- Số điện thoại
    Gender          TINYINT       NULL,           -- 0 = nữ, 1 = nam
    BirthDate       DATE          NULL,           -- Ngày sinh
    Address         NVARCHAR(255) NULL,           -- Địa chỉ
    HireDate        DATE          NOT NULL CONSTRAINT DF_Emp_Hire DEFAULT CAST(SYSDATETIME() AS DATE), -- Ngày vào làm
    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId),
    CONSTRAINT UQ_Employees_Account UNIQUE (AccountId),
    CONSTRAINT UQ_Employees_Code UNIQUE (EmployeeCode),
    CONSTRAINT FK_Employees_Account FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(AccountId),
    CONSTRAINT CK_Employees_Gender CHECK (Gender IN (0,1))
);

-- [Table] MembershipTiers: Hạng khách hàng thân thiết
CREATE TABLE dbo.MembershipTiers (
    TierId          INT IDENTITY(1,1) NOT NULL,   -- Mã hạng
    TierName        NVARCHAR(50)  NOT NULL,       -- Tên hạng (Thường, Bạc, Vàng, Kim cương)
    MinPoints       INT           NOT NULL,       -- Điểm tối thiểu để đạt hạng
    DiscountPercent DECIMAL(5,2)  NOT NULL CONSTRAINT DF_Tier_Disc DEFAULT 0, -- % ưu đãi
    CONSTRAINT PK_MembershipTiers PRIMARY KEY (TierId),
    CONSTRAINT UQ_Tier_Name UNIQUE (TierName),
    CONSTRAINT CK_Tier_Points CHECK (MinPoints >= 0),
    CONSTRAINT CK_Tier_Disc CHECK (DiscountPercent BETWEEN 0 AND 100)
);

-- [Table] Customers: Khách hàng (có thể có tài khoản online hoặc khách vãng lai)
CREATE TABLE dbo.Customers (
    CustomerId      INT IDENTITY(1,1) NOT NULL,   -- Mã khách hàng
    AccountId       INT           NULL,           -- Tài khoản online (NULL = khách vãng lai)
    FullName        NVARCHAR(100) NOT NULL,       -- Họ tên
    Phone           VARCHAR(15)   NOT NULL,       -- Số điện thoại (duy nhất)
    Email           VARCHAR(150)  NULL,           -- Email
    TierId          INT           NOT NULL CONSTRAINT DF_Cust_Tier DEFAULT 1, -- Hạng thân thiết
    LoyaltyPoints   INT           NOT NULL CONSTRAINT DF_Cust_Points DEFAULT 0, -- Điểm tích luỹ
    CompanyName     NVARCHAR(200) NULL,           -- Tên doanh nghiệp (xuất hoá đơn công ty)
    TaxCode         VARCHAR(20)   NULL,           -- Mã số thuế
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Cust_Created DEFAULT SYSDATETIME(), -- Ngày tạo
    CONSTRAINT PK_Customers PRIMARY KEY (CustomerId),
    CONSTRAINT UQ_Customers_Phone UNIQUE (Phone),
    CONSTRAINT FK_Customers_Account FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(AccountId),
    CONSTRAINT FK_Customers_Tier FOREIGN KEY (TierId) REFERENCES dbo.MembershipTiers(TierId),
    CONSTRAINT CK_Customers_Points CHECK (LoyaltyPoints >= 0)
);
CREATE UNIQUE INDEX UX_Customers_Account ON dbo.Customers(AccountId) WHERE AccountId IS NOT NULL;

-- [Table] CustomerAddresses: Sổ địa chỉ giao hàng của khách
CREATE TABLE dbo.CustomerAddresses (
    AddressId       INT IDENTITY(1,1) NOT NULL,   -- Mã địa chỉ
    CustomerId      INT           NOT NULL,       -- Khách hàng
    ReceiverName    NVARCHAR(100) NOT NULL,       -- Tên người nhận
    ReceiverPhone   VARCHAR(15)   NOT NULL,       -- SĐT người nhận
    AddressLine     NVARCHAR(200) NOT NULL,       -- Số nhà, đường
    Ward            NVARCHAR(100) NULL,           -- Phường/Xã
    District        NVARCHAR(100) NULL,           -- Quận/Huyện
    Province        NVARCHAR(100) NOT NULL,       -- Tỉnh/Thành phố
    IsDefault       BIT           NOT NULL CONSTRAINT DF_Addr_Default DEFAULT 0, -- Địa chỉ mặc định
    CONSTRAINT PK_CustomerAddresses PRIMARY KEY (AddressId),
    CONSTRAINT FK_Addr_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE
);
CREATE UNIQUE INDEX UX_Addr_OneDefault ON dbo.CustomerAddresses(CustomerId) WHERE IsDefault = 1;

-- [Table] AuditLogs: Nhật ký thao tác hệ thống (ai làm gì, lúc nào)
CREATE TABLE dbo.AuditLogs (
    AuditId         BIGINT IDENTITY(1,1) NOT NULL, -- Mã log
    AccountId       INT           NULL,           -- Người thực hiện (NULL = hệ thống)
    Action          VARCHAR(50)   NOT NULL,       -- Hành động (LOGIN, CREATE, UPDATE, DELETE...)
    EntityName      VARCHAR(50)   NULL,           -- Đối tượng bị tác động (Product, Order...)
    EntityId        VARCHAR(50)   NULL,           -- Khoá của đối tượng
    Detail          NVARCHAR(1000) NULL,          -- Chi tiết
    IpAddress       VARCHAR(45)   NULL,           -- Địa chỉ IP
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Audit_Created DEFAULT SYSDATETIME(), -- Thời điểm
    CONSTRAINT PK_AuditLogs PRIMARY KEY (AuditId),
    CONSTRAINT FK_Audit_Account FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(AccountId) ON DELETE SET NULL
);
CREATE INDEX IX_Audit_CreatedAt ON dbo.AuditLogs(CreatedAt DESC);
GO

/* =====================================================================
   NHÓM 2: DANH MỤC SẢN PHẨM   (Module 2)
   ===================================================================== */

-- [Table] Categories: Danh mục sản phẩm nhiều cấp (Laptop > Gaming, Linh kiện > RAM...)
CREATE TABLE dbo.Categories (
    CategoryId      INT IDENTITY(1,1) NOT NULL,   -- Mã danh mục
    ParentId        INT           NULL,           -- Danh mục cha (NULL = gốc)
    CategoryName    NVARCHAR(100) NOT NULL,       -- Tên danh mục
    Slug            VARCHAR(120)  NOT NULL,       -- Đường dẫn thân thiện URL
    SortOrder       INT           NOT NULL CONSTRAINT DF_Cat_Sort DEFAULT 0, -- Thứ tự hiển thị
    IsActive        BIT           NOT NULL CONSTRAINT DF_Cat_Active DEFAULT 1, -- Đang sử dụng
    CONSTRAINT PK_Categories PRIMARY KEY (CategoryId),
    CONSTRAINT UQ_Categories_Slug UNIQUE (Slug),
    CONSTRAINT FK_Categories_Parent FOREIGN KEY (ParentId) REFERENCES dbo.Categories(CategoryId)
);

-- [Table] Brands: Thương hiệu
CREATE TABLE dbo.Brands (
    BrandId         INT IDENTITY(1,1) NOT NULL,   -- Mã thương hiệu
    BrandName       NVARCHAR(100) NOT NULL,       -- Tên thương hiệu
    Country         NVARCHAR(60)  NULL,           -- Quốc gia
    LogoUrl         VARCHAR(300)  NULL,           -- Đường dẫn logo
    IsActive        BIT           NOT NULL CONSTRAINT DF_Brand_Active DEFAULT 1, -- Đang sử dụng
    CONSTRAINT PK_Brands PRIMARY KEY (BrandId),
    CONSTRAINT UQ_Brands_Name UNIQUE (BrandName)
);

-- [Table] Products: Sản phẩm (laptop, linh kiện, phụ kiện)
CREATE TABLE dbo.Products (
    ProductId       INT IDENTITY(1,1) NOT NULL,   -- Mã sản phẩm
    Sku             VARCHAR(40)   NOT NULL,       -- Mã SKU / mã model
    ProductName     NVARCHAR(200) NOT NULL,       -- Tên sản phẩm
    Slug            VARCHAR(220)  NOT NULL,       -- Đường dẫn thân thiện URL
    CategoryId      INT           NOT NULL,       -- Danh mục
    BrandId         INT           NOT NULL,       -- Thương hiệu
    ShortDesc       NVARCHAR(500) NULL,           -- Mô tả ngắn
    Description     NVARCHAR(MAX) NULL,           -- Mô tả chi tiết
    CostPrice       DECIMAL(18,0) NOT NULL CONSTRAINT DF_Prod_Cost DEFAULT 0, -- Giá nhập gần nhất
    SalePrice       DECIMAL(18,0) NOT NULL,       -- Giá bán niêm yết
    WarrantyMonths  INT           NOT NULL CONSTRAINT DF_Prod_Warranty DEFAULT 12, -- Bảo hành tiêu chuẩn (tháng)
    IsSerialTracked BIT           NOT NULL CONSTRAINT DF_Prod_Serial DEFAULT 0, -- 1 = quản lý theo Serial/IMEI
    IsActive        BIT           NOT NULL CONSTRAINT DF_Prod_Active DEFAULT 1, -- 1 = đang bán, 0 = ẩn
    QtyOnHand       INT           NOT NULL CONSTRAINT DF_Prod_OnHand DEFAULT 0, -- Tồn thực tế trong kho (gộp từ bảng Inventory cũ)
    QtyReserved     INT           NOT NULL CONSTRAINT DF_Prod_Reserved DEFAULT 0, -- Đã giữ chỗ cho đơn chờ duyệt
    ReorderLevel    INT           NOT NULL CONSTRAINT DF_Prod_Reorder DEFAULT 3, -- Ngưỡng cảnh báo sắp hết
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Prod_Created DEFAULT SYSDATETIME(), -- Ngày tạo
    UpdatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Prod_Updated DEFAULT SYSDATETIME(), -- Ngày cập nhật
    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku),
    CONSTRAINT UQ_Products_Slug UNIQUE (Slug),
    CONSTRAINT FK_Products_Category FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(CategoryId),
    CONSTRAINT FK_Products_Brand FOREIGN KEY (BrandId) REFERENCES dbo.Brands(BrandId),
    CONSTRAINT CK_Products_Price CHECK (SalePrice >= 0 AND CostPrice >= 0),
    CONSTRAINT CK_Products_Warranty CHECK (WarrantyMonths >= 0),
    CONSTRAINT CK_Products_Stock CHECK (QtyOnHand >= 0 AND QtyReserved >= 0 AND ReorderLevel >= 0 AND QtyReserved <= QtyOnHand)
);
CREATE INDEX IX_Products_Category ON dbo.Products(CategoryId) INCLUDE (SalePrice, IsActive);
CREATE INDEX IX_Products_Brand ON dbo.Products(BrandId);
CREATE INDEX IX_Products_Price ON dbo.Products(SalePrice) INCLUDE (ProductName, IsActive);
CREATE INDEX IX_Products_Name ON dbo.Products(ProductName);

-- [Table] ProductImages: Ảnh sản phẩm
CREATE TABLE dbo.ProductImages (
    ImageId         INT IDENTITY(1,1) NOT NULL,   -- Mã ảnh
    ProductId       INT           NOT NULL,       -- Sản phẩm
    ImageUrl        VARCHAR(300)  NOT NULL,       -- Đường dẫn ảnh
    IsPrimary       BIT           NOT NULL CONSTRAINT DF_Img_Primary DEFAULT 0, -- Ảnh đại diện
    SortOrder       INT           NOT NULL CONSTRAINT DF_Img_Sort DEFAULT 0, -- Thứ tự
    CONSTRAINT PK_ProductImages PRIMARY KEY (ImageId),
    CONSTRAINT FK_Img_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE
);
CREATE UNIQUE INDEX UX_Img_OnePrimary ON dbo.ProductImages(ProductId) WHERE IsPrimary = 1;

-- [Table] Attributes: Danh mục thuộc tính kỹ thuật (CPU, RAM, chuẩn SSD...) - mô hình EAV
CREATE TABLE dbo.Attributes (
    AttributeId     INT IDENTITY(1,1) NOT NULL,   -- Mã thuộc tính
    AttrCode        VARCHAR(40)   NOT NULL,       -- Mã code (CPU, RAM_TYPE...)
    AttrName        NVARCHAR(100) NOT NULL,       -- Tên hiển thị
    Unit            NVARCHAR(20)  NULL,           -- Đơn vị (GB, Hz, kg, inch)
    IsFilterable    BIT           NOT NULL CONSTRAINT DF_Attr_Filter DEFAULT 0, -- Cho phép lọc ở trang cửa hàng
    CONSTRAINT PK_Attributes PRIMARY KEY (AttributeId),
    CONSTRAINT UQ_Attributes_Code UNIQUE (AttrCode)
);

-- [Table] ProductAttributeValues: Giá trị thuộc tính của từng sản phẩm
CREATE TABLE dbo.ProductAttributeValues (
    ProductId       INT           NOT NULL,       -- Sản phẩm
    AttributeId     INT           NOT NULL,       -- Thuộc tính
    AttrValue       NVARCHAR(200) NOT NULL,       -- Giá trị (vd: DDR5, 16GB)
    CONSTRAINT PK_ProductAttrValues PRIMARY KEY (ProductId, AttributeId),
    CONSTRAINT FK_PAV_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE CASCADE,
    CONSTRAINT FK_PAV_Attribute FOREIGN KEY (AttributeId) REFERENCES dbo.Attributes(AttributeId)
);

-- [Table] CompatibilityRules: Luật tương thích (giá trị thuộc tính của linh kiện phải trùng với máy)
CREATE TABLE dbo.CompatibilityRules (
    RuleId              INT IDENTITY(1,1) NOT NULL, -- Mã luật
    MainCategoryId      INT           NOT NULL,     -- Danh mục sản phẩm chính (Laptop)
    ComponentCategoryId INT           NOT NULL,     -- Danh mục linh kiện (RAM, SSD)
    AttributeId         INT           NOT NULL,     -- Thuộc tính phải khớp (RAM_TYPE, SSD_INTERFACE)
    Description         NVARCHAR(255) NULL,         -- Diễn giải luật
    CONSTRAINT PK_CompatRules PRIMARY KEY (RuleId),
    CONSTRAINT UQ_CompatRules UNIQUE (MainCategoryId, ComponentCategoryId, AttributeId),
    CONSTRAINT FK_Compat_Main FOREIGN KEY (MainCategoryId) REFERENCES dbo.Categories(CategoryId),
    CONSTRAINT FK_Compat_Comp FOREIGN KEY (ComponentCategoryId) REFERENCES dbo.Categories(CategoryId),
    CONSTRAINT FK_Compat_Attr FOREIGN KEY (AttributeId) REFERENCES dbo.Attributes(AttributeId)
);
GO

/* =====================================================================
   NHÓM 3: KHO - NHÀ CUNG CẤP - SERIAL   (Module 1 - phân hệ Kho)
   ===================================================================== */

-- (Bảng Inventory đã gộp vào Products.QtyOnHand/QtyReserved/ReorderLevel để đơn giản hoá - xem NHÓM 2)

-- [Table] Suppliers: Nhà cung cấp / nhà phân phối
CREATE TABLE dbo.Suppliers (
    SupplierId      INT IDENTITY(1,1) NOT NULL,   -- Mã nhà cung cấp
    SupplierName    NVARCHAR(200) NOT NULL,       -- Tên nhà cung cấp
    TaxCode         VARCHAR(20)   NULL,           -- Mã số thuế
    ContactName     NVARCHAR(100) NULL,           -- Người liên hệ
    Phone           VARCHAR(15)   NULL,           -- Điện thoại
    Email           VARCHAR(150)  NULL,           -- Email
    Address         NVARCHAR(255) NULL,           -- Địa chỉ
    PaymentTermDays INT           NOT NULL CONSTRAINT DF_Sup_Term DEFAULT 30, -- Hạn thanh toán (ngày)
    IsActive        BIT           NOT NULL CONSTRAINT DF_Sup_Active DEFAULT 1, -- Đang hợp tác
    CONSTRAINT PK_Suppliers PRIMARY KEY (SupplierId),
    CONSTRAINT CK_Sup_Term CHECK (PaymentTermDays >= 0)
);
CREATE UNIQUE INDEX UX_Suppliers_TaxCode ON dbo.Suppliers(TaxCode) WHERE TaxCode IS NOT NULL;

-- [Table] GoodsReceipts: Phiếu nhập kho
CREATE TABLE dbo.GoodsReceipts (
    ReceiptId       INT IDENTITY(1,1) NOT NULL,   -- Mã phiếu nhập
    ReceiptNo       VARCHAR(20)   NOT NULL,       -- Số phiếu (PN2609-00001)
    SupplierId      INT           NOT NULL,       -- Nhà cung cấp
    EmployeeId      INT           NOT NULL,       -- Nhân viên lập phiếu
    ReceiptDate     DATETIME2(0)  NOT NULL CONSTRAINT DF_GR_Date DEFAULT SYSDATETIME(), -- Ngày nhập
    Status          VARCHAR(10)   NOT NULL CONSTRAINT DF_GR_Status DEFAULT 'Draft', -- Draft / Posted / Cancelled
    TotalAmount     DECIMAL(18,0) NOT NULL CONSTRAINT DF_GR_Total DEFAULT 0, -- Tổng tiền hàng
    PaidAmount      DECIMAL(18,0) NOT NULL CONSTRAINT DF_GR_Paid DEFAULT 0, -- Đã thanh toán cho NCC
    DueDate         DATE          NULL,           -- Hạn thanh toán
    Note            NVARCHAR(255) NULL,           -- Ghi chú
    CONSTRAINT PK_GoodsReceipts PRIMARY KEY (ReceiptId),
    CONSTRAINT UQ_GR_No UNIQUE (ReceiptNo),
    CONSTRAINT FK_GR_Supplier FOREIGN KEY (SupplierId) REFERENCES dbo.Suppliers(SupplierId),
    CONSTRAINT FK_GR_Employee FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
    CONSTRAINT CK_GR_Status CHECK (Status IN ('Draft','Posted','Cancelled')),
    CONSTRAINT CK_GR_Paid CHECK (PaidAmount >= 0 AND PaidAmount <= TotalAmount OR Status = 'Draft')
);
CREATE INDEX IX_GR_Date ON dbo.GoodsReceipts(ReceiptDate DESC);
CREATE INDEX IX_GR_Supplier ON dbo.GoodsReceipts(SupplierId, ReceiptDate DESC);

-- [Table] GoodsReceiptDetails: Chi tiết phiếu nhập
CREATE TABLE dbo.GoodsReceiptDetails (
    ReceiptDetailId INT IDENTITY(1,1) NOT NULL,   -- Mã dòng chi tiết
    ReceiptId       INT           NOT NULL,       -- Phiếu nhập
    ProductId       INT           NOT NULL,       -- Sản phẩm
    Quantity        INT           NOT NULL,       -- Số lượng nhập
    UnitCost        DECIMAL(18,0) NOT NULL,       -- Đơn giá nhập
    LineTotal       AS (Quantity * UnitCost) PERSISTED, -- Thành tiền (cột tính toán)
    CONSTRAINT PK_GRDetails PRIMARY KEY (ReceiptDetailId),
    CONSTRAINT UQ_GRDetails UNIQUE (ReceiptId, ProductId),
    CONSTRAINT FK_GRD_Receipt FOREIGN KEY (ReceiptId) REFERENCES dbo.GoodsReceipts(ReceiptId) ON DELETE CASCADE,
    CONSTRAINT FK_GRD_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
    CONSTRAINT CK_GRD_Qty CHECK (Quantity > 0),
    CONSTRAINT CK_GRD_Cost CHECK (UnitCost >= 0)
);
CREATE INDEX IX_GRD_Product ON dbo.GoodsReceiptDetails(ProductId);

-- [Table] ProductSerials: Từng cá thể sản phẩm có Serial/IMEI (laptop, RAM, SSD...)
CREATE TABLE dbo.ProductSerials (
    SerialId        BIGINT IDENTITY(1,1) NOT NULL, -- Mã cá thể
    ProductId       INT           NOT NULL,       -- Sản phẩm
    SerialNumber    VARCHAR(60)   NOT NULL,       -- Số Serial (duy nhất toàn hệ thống)
    Imei            VARCHAR(20)   NULL,           -- IMEI (nếu có)
    Barcode         VARCHAR(50)   NULL,           -- Mã vạch
    ReceiptDetailId INT           NOT NULL,       -- Nhập từ dòng phiếu nhập nào
    Status          VARCHAR(12)   NOT NULL CONSTRAINT DF_Serial_Status DEFAULT 'Pending', -- Pending/InStock/Sold/InWarranty/SentToVendor/Defective
    CONSTRAINT PK_ProductSerials PRIMARY KEY (SerialId),
    CONSTRAINT UQ_Serial_Number UNIQUE (SerialNumber),
    CONSTRAINT FK_Serial_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
    CONSTRAINT FK_Serial_GRD FOREIGN KEY (ReceiptDetailId) REFERENCES dbo.GoodsReceiptDetails(ReceiptDetailId),
    CONSTRAINT CK_Serial_Status CHECK (Status IN ('Pending','InStock','Sold','InWarranty','SentToVendor','Defective'))
);
CREATE UNIQUE INDEX UX_Serial_Imei ON dbo.ProductSerials(Imei) WHERE Imei IS NOT NULL;
CREATE INDEX IX_Serial_ProductStatus ON dbo.ProductSerials(ProductId, Status);
CREATE INDEX IX_Serial_GRD ON dbo.ProductSerials(ReceiptDetailId);

-- (Bảng StockMovements đã bỏ để đơn giản hoá - lịch sử nhập/xuất có thể tra qua GoodsReceiptDetails + OrderDetails,
--  biến động quan trọng vẫn được ghi vào AuditLogs)
GO

/* =====================================================================
   NHÓM 4: GIỎ HÀNG - KHUYẾN MÃI - ĐƠN HÀNG   (Module 3 & 4)
   ===================================================================== */

-- [Table] Carts: Giỏ hàng (mỗi khách 1 giỏ)
CREATE TABLE dbo.Carts (
    CartId          INT IDENTITY(1,1) NOT NULL,   -- Mã giỏ
    CustomerId      INT           NOT NULL,       -- Khách hàng
    UpdatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Cart_Updated DEFAULT SYSDATETIME(), -- Cập nhật lần cuối
    CONSTRAINT PK_Carts PRIMARY KEY (CartId),
    CONSTRAINT UQ_Carts_Customer UNIQUE (CustomerId),
    CONSTRAINT FK_Carts_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE
);

-- [Table] CartItems: Sản phẩm trong giỏ
CREATE TABLE dbo.CartItems (
    CartId          INT           NOT NULL,       -- Giỏ hàng
    ProductId       INT           NOT NULL,       -- Sản phẩm
    Quantity        INT           NOT NULL,       -- Số lượng
    AddedAt         DATETIME2(0)  NOT NULL CONSTRAINT DF_CI_Added DEFAULT SYSDATETIME(), -- Thời điểm thêm
    CONSTRAINT PK_CartItems PRIMARY KEY (CartId, ProductId),
    CONSTRAINT FK_CI_Cart FOREIGN KEY (CartId) REFERENCES dbo.Carts(CartId) ON DELETE CASCADE,
    CONSTRAINT FK_CI_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
    CONSTRAINT CK_CI_Qty CHECK (Quantity BETWEEN 1 AND 99)
);

-- [Table] Promotions: Mã khuyến mãi / voucher
CREATE TABLE dbo.Promotions (
    PromotionId     INT IDENTITY(1,1) NOT NULL,   -- Mã khuyến mãi
    Code            VARCHAR(30)   NOT NULL,       -- Mã voucher nhập khi thanh toán
    PromoName       NVARCHAR(150) NOT NULL,       -- Tên chương trình
    DiscountType    VARCHAR(10)   NOT NULL,       -- Percent (theo %) hoặc Amount (số tiền)
    DiscountValue   DECIMAL(18,2) NOT NULL,       -- Giá trị giảm
    MinOrderAmount  DECIMAL(18,0) NOT NULL CONSTRAINT DF_Promo_Min DEFAULT 0, -- Đơn tối thiểu để áp dụng
    MaxDiscount     DECIMAL(18,0) NULL,           -- Giảm tối đa (cho loại %)
    StartDate       DATETIME2(0)  NOT NULL,       -- Bắt đầu
    EndDate         DATETIME2(0)  NOT NULL,       -- Kết thúc
    UsageLimit      INT           NULL,           -- Số lượt dùng tối đa (NULL = không giới hạn)
    UsedCount       INT           NOT NULL CONSTRAINT DF_Promo_Used DEFAULT 0, -- Đã dùng
    IsActive        BIT           NOT NULL CONSTRAINT DF_Promo_Active DEFAULT 1, -- Đang bật
    CONSTRAINT PK_Promotions PRIMARY KEY (PromotionId),
    CONSTRAINT UQ_Promotions_Code UNIQUE (Code),
    CONSTRAINT CK_Promo_Type CHECK (DiscountType IN ('Percent','Amount')),
    CONSTRAINT CK_Promo_Value CHECK (DiscountValue > 0 AND (DiscountType = 'Amount' OR DiscountValue <= 100)),
    CONSTRAINT CK_Promo_Dates CHECK (EndDate >= StartDate),
    CONSTRAINT CK_Promo_Used CHECK (UsedCount >= 0 AND (UsageLimit IS NULL OR UsedCount <= UsageLimit))
);

-- [Table] Orders: Đơn hàng
CREATE TABLE dbo.Orders (
    OrderId         INT IDENTITY(1,1) NOT NULL,   -- Mã đơn
    OrderNo         VARCHAR(20)   NOT NULL,       -- Số đơn hiển thị (DH2609-00001)
    CustomerId      INT           NOT NULL,       -- Khách đặt
    SalesEmployeeId INT           NULL,           -- Nhân viên duyệt/xử lý
    PromotionId     INT           NULL,           -- Khuyến mãi đã áp dụng
    Status          VARCHAR(10)   NOT NULL CONSTRAINT DF_Ord_Status DEFAULT 'Pending', -- Pending / Approved / Completed / Cancelled
    PaymentMethod   VARCHAR(15)   NOT NULL,       -- COD / BankTransfer / Card / Installment / Cash
    PaymentStatus   VARCHAR(10)   NOT NULL CONSTRAINT DF_Ord_PayStatus DEFAULT 'Pending', -- Pending / Paid / Refunded (gộp từ bảng Payments cũ)
    PaidAt          DATETIME2(0)  NULL,           -- Thời điểm thanh toán
    ReceiverName    NVARCHAR(100) NOT NULL,       -- Người nhận (snapshot)
    ReceiverPhone   VARCHAR(15)   NOT NULL,       -- SĐT nhận (snapshot)
    ShippingAddress NVARCHAR(400) NOT NULL,       -- Địa chỉ giao (snapshot)
    Subtotal        DECIMAL(18,0) NOT NULL,       -- Tổng tiền hàng
    DiscountAmount  DECIMAL(18,0) NOT NULL CONSTRAINT DF_Ord_Disc DEFAULT 0, -- Giảm giá
    ShippingFee     DECIMAL(18,0) NOT NULL CONSTRAINT DF_Ord_Ship DEFAULT 0, -- Phí vận chuyển
    VatRate         DECIMAL(5,2)  NOT NULL CONSTRAINT DF_Ord_Vat DEFAULT 10, -- Thuế suất VAT (%)
    VatAmount       AS (ROUND((Subtotal - DiscountAmount) * VatRate / 100, 0)) PERSISTED, -- Tiền VAT (cột tính toán)
    TotalAmount     AS (Subtotal - DiscountAmount + ShippingFee + ROUND((Subtotal - DiscountAmount) * VatRate / 100, 0)) PERSISTED, -- Tổng thanh toán (cột tính toán)
    Note            NVARCHAR(500) NULL,           -- Ghi chú của khách
    CancelReason    NVARCHAR(255) NULL,           -- Lý do huỷ
    CreatedAt       DATETIME2(0)  NOT NULL CONSTRAINT DF_Ord_Created DEFAULT SYSDATETIME(), -- Ngày đặt
    ApprovedAt      DATETIME2(0)  NULL,           -- Ngày duyệt
    CompletedAt     DATETIME2(0)  NULL,           -- Ngày hoàn tất giao hàng
    CancelledAt     DATETIME2(0)  NULL,           -- Ngày huỷ
    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT UQ_Orders_No UNIQUE (OrderNo),
    CONSTRAINT FK_Orders_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Orders_Employee FOREIGN KEY (SalesEmployeeId) REFERENCES dbo.Employees(EmployeeId),
    CONSTRAINT FK_Orders_Promotion FOREIGN KEY (PromotionId) REFERENCES dbo.Promotions(PromotionId),
    CONSTRAINT CK_Orders_Status CHECK (Status IN ('Pending','Approved','Completed','Cancelled')),
    CONSTRAINT CK_Orders_Payment CHECK (PaymentMethod IN ('COD','BankTransfer','Card','Installment','Cash')),
    CONSTRAINT CK_Orders_PayStatus CHECK (PaymentStatus IN ('Pending','Paid','Refunded')),
    CONSTRAINT CK_Orders_Money CHECK (Subtotal >= 0 AND DiscountAmount >= 0 AND DiscountAmount <= Subtotal AND ShippingFee >= 0)
);
CREATE INDEX IX_Orders_Customer ON dbo.Orders(CustomerId, CreatedAt DESC);
CREATE INDEX IX_Orders_StatusDate ON dbo.Orders(Status, CreatedAt DESC) INCLUDE (Subtotal, DiscountAmount, ShippingFee, VatRate);

-- [Table] OrderDetails: Chi tiết đơn hàng
CREATE TABLE dbo.OrderDetails (
    OrderDetailId   INT IDENTITY(1,1) NOT NULL,   -- Mã dòng chi tiết
    OrderId         INT           NOT NULL,       -- Đơn hàng
    ProductId       INT           NOT NULL,       -- Sản phẩm
    Quantity        INT           NOT NULL,       -- Số lượng
    UnitPrice       DECIMAL(18,0) NOT NULL,       -- Đơn giá bán tại thời điểm đặt
    CostPrice       DECIMAL(18,0) NOT NULL,       -- Giá vốn tại thời điểm đặt (tính lợi nhuận)
    WarrantyMonths  INT           NOT NULL,       -- Số tháng bảo hành áp dụng
    LineTotal       AS (Quantity * UnitPrice) PERSISTED, -- Thành tiền (cột tính toán)
    CONSTRAINT PK_OrderDetails PRIMARY KEY (OrderDetailId),
    CONSTRAINT UQ_OrderDetails UNIQUE (OrderId, ProductId),
    CONSTRAINT FK_OD_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_OD_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
    CONSTRAINT CK_OD_Qty CHECK (Quantity > 0),
    CONSTRAINT CK_OD_Money CHECK (UnitPrice >= 0 AND CostPrice >= 0 AND WarrantyMonths >= 0)
);
CREATE INDEX IX_OD_Product ON dbo.OrderDetails(ProductId) INCLUDE (Quantity, UnitPrice);

-- [Table] OrderDetailSerials: Serial cụ thể đã xuất bán cho từng dòng đơn (gán khi duyệt đơn)
CREATE TABLE dbo.OrderDetailSerials (
    OrderDetailId   INT           NOT NULL,       -- Dòng chi tiết đơn
    SerialId        BIGINT        NOT NULL,       -- Cá thể sản phẩm đã bán
    CONSTRAINT PK_OrderDetailSerials PRIMARY KEY (OrderDetailId, SerialId),
    CONSTRAINT FK_ODS_Detail FOREIGN KEY (OrderDetailId) REFERENCES dbo.OrderDetails(OrderDetailId),
    CONSTRAINT FK_ODS_Serial FOREIGN KEY (SerialId) REFERENCES dbo.ProductSerials(SerialId)
);
CREATE INDEX IX_ODS_Serial ON dbo.OrderDetailSerials(SerialId);

-- (Bảng OrderStatusHistory đã bỏ để đơn giản hoá - việc đổi trạng thái ghi qua AuditLogs dùng chung toàn hệ thống)
-- (Bảng Payments đã gộp vào Orders.PaymentStatus/PaidAt để đơn giản hoá - mỗi đơn 1 lần thanh toán)

-- [Table] Invoices: Hoá đơn bán hàng (phát hành khi duyệt đơn, lưu trữ, in lại được)
CREATE TABLE dbo.Invoices (
    InvoiceId       INT IDENTITY(1,1) NOT NULL,   -- Mã hoá đơn
    InvoiceNo       VARCHAR(20)   NOT NULL,       -- Số hoá đơn (HD2609-00001)
    OrderId         INT           NOT NULL,       -- Đơn hàng (1 đơn - 1 hoá đơn)
    IssuedByEmployee INT          NOT NULL,       -- Nhân viên phát hành
    IssuedAt        DATETIME2(0)  NOT NULL CONSTRAINT DF_Inv_Issued DEFAULT SYSDATETIME(), -- Ngày phát hành
    BuyerName       NVARCHAR(100) NOT NULL,       -- Tên người mua
    BuyerCompany    NVARCHAR(200) NULL,           -- Tên đơn vị (nếu xuất công ty)
    BuyerTaxCode    VARCHAR(20)   NULL,           -- MST người mua
    BuyerAddress    NVARCHAR(400) NOT NULL,       -- Địa chỉ người mua
    SubtotalAmount  DECIMAL(18,0) NOT NULL,       -- Tiền hàng
    DiscountAmount  DECIMAL(18,0) NOT NULL,       -- Giảm giá
    VatAmount       DECIMAL(18,0) NOT NULL,       -- Tiền VAT
    TotalAmount     DECIMAL(18,0) NOT NULL,       -- Tổng thanh toán
    PrintCount      INT           NOT NULL CONSTRAINT DF_Invoice_Print DEFAULT 0, -- Số lần đã in
    Status          VARCHAR(10)   NOT NULL CONSTRAINT DF_Invoice_Status DEFAULT 'Issued', -- Issued / Voided
    CONSTRAINT PK_Invoices PRIMARY KEY (InvoiceId),
    CONSTRAINT UQ_Invoices_No UNIQUE (InvoiceNo),
    CONSTRAINT UQ_Invoices_Order UNIQUE (OrderId),
    CONSTRAINT FK_Invoices_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
    CONSTRAINT FK_Invoices_Employee FOREIGN KEY (IssuedByEmployee) REFERENCES dbo.Employees(EmployeeId),
    CONSTRAINT CK_Invoices_Status CHECK (Status IN ('Issued','Voided'))
);
CREATE INDEX IX_Invoices_IssuedAt ON dbo.Invoices(IssuedAt DESC);

-- [Table] Warranties: Bảo hành điện tử theo từng Serial (tự tạo khi duyệt đơn)
CREATE TABLE dbo.Warranties (
    WarrantyId      INT IDENTITY(1,1) NOT NULL,   -- Mã bảo hành
    SerialId        BIGINT        NOT NULL,       -- Cá thể được bảo hành
    OrderDetailId   INT           NOT NULL,       -- Dòng đơn hàng đã bán
    CustomerId      INT           NOT NULL,       -- Khách hàng sở hữu
    StartDate       DATE          NOT NULL,       -- Ngày bắt đầu
    EndDate         DATE          NOT NULL,       -- Ngày hết hạn
    Status          VARCHAR(10)   NOT NULL CONSTRAINT DF_War_Status DEFAULT 'Active', -- Active / Voided
    CONSTRAINT PK_Warranties PRIMARY KEY (WarrantyId),
    CONSTRAINT UQ_Warranties UNIQUE (SerialId, OrderDetailId),
    CONSTRAINT FK_War_Serial FOREIGN KEY (SerialId) REFERENCES dbo.ProductSerials(SerialId),
    CONSTRAINT FK_War_Detail FOREIGN KEY (OrderDetailId) REFERENCES dbo.OrderDetails(OrderDetailId),
    CONSTRAINT FK_War_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT CK_War_Dates CHECK (EndDate >= StartDate),
    CONSTRAINT CK_War_Status CHECK (Status IN ('Active','Voided'))
);
CREATE INDEX IX_War_Customer ON dbo.Warranties(CustomerId);
GO
