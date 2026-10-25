/* =====================================================================
   File 02: TRIGGER + VIEW + STORED PROCEDURE  (yêu cầu SQL Server 2017+)
   Nghiệp vụ lõi (đặt / duyệt / huỷ đơn, nhập kho) nằm trong Stored Procedure
   để bảo đảm toàn vẹn dữ liệu bằng transaction. Node.js chỉ gọi EXEC.
   Mã lỗi nghiệp vụ: THROW 50xxx (Node bắt err.number để hiển thị thông báo).
   ===================================================================== */
USE LaptopShopDB;
GO

-- (Trigger tự tạo dòng Inventory đã bỏ - QtyOnHand/QtyReserved/ReorderLevel nay là cột của Products,
--  có DEFAULT sẵn nên không cần trigger khi thêm sản phẩm)

/* ---------- VIEW ---------- */

-- Danh sách sản phẩm cho cửa hàng: kèm danh mục, thương hiệu, ảnh đại diện, tồn có thể bán
CREATE VIEW dbo.vw_ProductCatalog
AS
SELECT  p.ProductId, p.Sku, p.ProductName, p.Slug, p.ShortDesc,
        p.SalePrice, p.CostPrice, p.WarrantyMonths, p.IsSerialTracked, p.IsActive,
        p.CategoryId, c.CategoryName, c.Slug AS CategorySlug, c.ParentId AS CategoryParentId,
        p.BrandId, b.BrandName,
        p.QtyOnHand, p.QtyReserved, (p.QtyOnHand - p.QtyReserved) AS QtyAvailable, p.ReorderLevel,
        img.ImageUrl AS PrimaryImage
FROM    dbo.Products p
JOIN    dbo.Categories c ON c.CategoryId = p.CategoryId
JOIN    dbo.Brands b     ON b.BrandId = p.BrandId
LEFT JOIN dbo.ProductImages img ON img.ProductId = p.ProductId AND img.IsPrimary = 1;
GO

-- Sản phẩm sắp hết hàng (tồn có thể bán <= ngưỡng)
CREATE VIEW dbo.vw_LowStock
AS
SELECT  ProductId, Sku, ProductName, CategoryName, BrandName, QtyOnHand, QtyReserved, QtyAvailable, ReorderLevel
FROM    dbo.vw_ProductCatalog
WHERE   IsActive = 1 AND QtyAvailable <= ReorderLevel;
GO

-- Doanh thu theo ngày (tính theo ngày duyệt của đơn Approved/Completed)
CREATE VIEW dbo.vw_SalesDaily
AS
SELECT  CAST(o.ApprovedAt AS DATE) AS SaleDate,
        COUNT(*)                   AS OrderCount,
        SUM(o.Subtotal)            AS GrossAmount,
        SUM(o.DiscountAmount)      AS DiscountAmount,
        SUM(o.VatAmount)           AS VatAmount,
        SUM(o.TotalAmount)         AS Revenue
FROM    dbo.Orders o
WHERE   o.Status IN ('Approved','Completed') AND o.ApprovedAt IS NOT NULL
GROUP BY CAST(o.ApprovedAt AS DATE);
GO

-- Doanh số + lợi nhuận gộp theo sản phẩm (sản phẩm bán chạy)
-- SalesAmount       : tổng tiền hàng theo đơn giá bán, CHƯA trừ voucher (để đối chiếu với báo cáo doanh thu gộp).
-- NetSalesAmount     : tiền hàng sau khi phân bổ voucher của đơn theo tỷ trọng từng dòng (Subtotal), dùng để tính lợi nhuận.
-- CostAmount         : giá vốn thực tế. Với sản phẩm quản lý Serial, lấy đúng UnitCost của lô nhập đã xuất bán
--                      (qua OrderDetailSerials -> ProductSerials -> GoodsReceiptDetails); sản phẩm không quản lý Serial
--                      không có cách tra lô xuất cụ thể nên tạm dùng CostPrice đã chốt tại thời điểm bán (OrderDetails.CostPrice).
-- GrossProfit        : NetSalesAmount - CostAmount (lợi nhuận gộp đã trừ voucher).
CREATE VIEW dbo.vw_ProductSales
AS
WITH Lines AS (
    SELECT  d.OrderDetailId, d.ProductId, d.Quantity, d.LineTotal, d.CostPrice,
            d.LineTotal - ROUND(d.LineTotal * ISNULL(o.DiscountAmount, 0) / NULLIF(o.Subtotal, 0), 0) AS NetLineTotal,
            CASE WHEN p.IsSerialTracked = 1 THEN
                (SELECT SUM(grd.UnitCost)
                 FROM dbo.OrderDetailSerials ods
                 JOIN dbo.ProductSerials ps ON ps.SerialId = ods.SerialId
                 JOIN dbo.GoodsReceiptDetails grd ON grd.ReceiptDetailId = ps.ReceiptDetailId
                 WHERE ods.OrderDetailId = d.OrderDetailId)
            ELSE NULL END AS ActualLotCost
    FROM    dbo.OrderDetails d
    JOIN    dbo.Orders o   ON o.OrderId = d.OrderId AND o.Status IN ('Approved','Completed')
    JOIN    dbo.Products p ON p.ProductId = d.ProductId
)
SELECT  p.ProductId, p.Sku, p.ProductName, c.CategoryName, b.BrandName,
        SUM(l.Quantity)                                              AS QtySold,
        SUM(l.LineTotal)                                             AS SalesAmount,
        SUM(l.NetLineTotal)                                          AS NetSalesAmount,
        SUM(ISNULL(l.ActualLotCost, l.Quantity * l.CostPrice))       AS CostAmount,
        SUM(l.NetLineTotal - ISNULL(l.ActualLotCost, l.Quantity * l.CostPrice)) AS GrossProfit
FROM    Lines l
JOIN    dbo.Products p   ON p.ProductId = l.ProductId
JOIN    dbo.Categories c ON c.CategoryId = p.CategoryId
JOIN    dbo.Brands b     ON b.BrandId = p.BrandId
GROUP BY p.ProductId, p.Sku, p.ProductName, c.CategoryName, b.BrandName;
GO

-- Công nợ phải trả nhà cung cấp
CREATE VIEW dbo.vw_SupplierPayables
AS
SELECT  s.SupplierId, s.SupplierName,
        SUM(g.TotalAmount)                 AS TotalPurchased,
        SUM(g.PaidAmount)                  AS TotalPaid,
        SUM(g.TotalAmount - g.PaidAmount)  AS Outstanding
FROM    dbo.Suppliers s
JOIN    dbo.GoodsReceipts g ON g.SupplierId = s.SupplierId AND g.Status = 'Posted'
GROUP BY s.SupplierId, s.SupplierName;
GO

/* ---------- STORED PROCEDURE: NHẬP KHO ---------- */
-- Chốt phiếu nhập: Draft -> Posted. Cộng tồn, kích hoạt serial, cập nhật giá vốn, ghi sổ kho.
-- Node phải INSERT sẵn GoodsReceipts(Draft) + GoodsReceiptDetails + ProductSerials(Pending) trong 1 transaction.
CREATE PROCEDURE dbo.sp_PostGoodsReceipt
    @ReceiptId INT,
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10);

    IF NOT EXISTS (SELECT 1 FROM dbo.Accounts WHERE AccountId = @AccountId AND IsActive = 1)
        THROW 50039, N'Tài khoản thực hiện không hợp lệ hoặc đã bị khoá.', 1;

    SELECT @Status = Status FROM dbo.GoodsReceipts WITH (UPDLOCK, ROWLOCK) WHERE ReceiptId = @ReceiptId;

    IF @Status IS NULL THROW 50040, N'Phiếu nhập không tồn tại.', 1;
    IF @Status <> 'Draft' THROW 50041, N'Chỉ chốt được phiếu nhập ở trạng thái Nháp.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.GoodsReceiptDetails WHERE ReceiptId = @ReceiptId)
        THROW 50042, N'Phiếu nhập chưa có dòng chi tiết.', 1;

    -- Sản phẩm quản lý serial: số serial nhập phải đúng bằng số lượng
    IF EXISTS (
        SELECT 1
        FROM dbo.GoodsReceiptDetails d
        JOIN dbo.Products p ON p.ProductId = d.ProductId
        WHERE d.ReceiptId = @ReceiptId AND p.IsSerialTracked = 1
          AND d.Quantity <> (SELECT COUNT(*) FROM dbo.ProductSerials s WHERE s.ReceiptDetailId = d.ReceiptDetailId)
    )
        THROW 50043, N'Số lượng Serial nhập không khớp số lượng sản phẩm quản lý theo Serial.', 1;

    UPDATE s SET s.Status = 'InStock'
    FROM dbo.ProductSerials s
    JOIN dbo.GoodsReceiptDetails d ON d.ReceiptDetailId = s.ReceiptDetailId
    WHERE d.ReceiptId = @ReceiptId AND s.Status = 'Pending';

    UPDATE p SET p.QtyOnHand = p.QtyOnHand + d.Quantity, p.CostPrice = d.UnitCost, p.UpdatedAt = SYSDATETIME()
    FROM dbo.Products p
    JOIN dbo.GoodsReceiptDetails d ON d.ProductId = p.ProductId
    WHERE d.ReceiptId = @ReceiptId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    SELECT @AccountId, 'STOCK_IN', 'Product', CAST(d.ProductId AS VARCHAR(50)),
           CONCAT(N'Nhập kho +', d.Quantity, N' theo phiếu nhập #', @ReceiptId)
    FROM dbo.GoodsReceiptDetails d
    WHERE d.ReceiptId = @ReceiptId;

    UPDATE g SET g.Status = 'Posted',
                 g.TotalAmount = (SELECT SUM(LineTotal) FROM dbo.GoodsReceiptDetails WHERE ReceiptId = @ReceiptId),
                 g.DueDate = DATEADD(DAY, sp.PaymentTermDays, CAST(g.ReceiptDate AS DATE))
    FROM dbo.GoodsReceipts g
    JOIN dbo.Suppliers sp ON sp.SupplierId = g.SupplierId
    WHERE g.ReceiptId = @ReceiptId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'POST', 'GoodsReceipt', CAST(@ReceiptId AS VARCHAR(50)), N'Chốt phiếu nhập kho (Draft -> Posted)');

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: ĐẶT HÀNG ---------- */
-- Dùng chung cho khách ĐÃ đăng nhập (đọc giỏ trong DB) và khách CHƯA đăng nhập (giỏ lưu trong session, gửi lên dạng JSON).
-- Thông tin người nhận (tên / SĐT / địa chỉ) chỉ bắt buộc ở bước chốt đơn này, không bắt buộc lúc tạo tài khoản.
-- Tạo đơn, GIỮ CHỖ tồn kho (QtyReserved), áp voucher, xoá giỏ.
-- Quy tắc xác nhận: đơn chỉ có ĐÚNG 1 sản phẩm (tổng số lượng = 1) và còn serial -> hệ thống tự xác nhận ngay
-- (Approved, trừ tồn thật, phát hành hoá đơn). Đơn từ 2 sản phẩm trở lên giữ trạng thái Pending ("Đang kiểm tra hàng")
-- để nhân viên kiểm tra tồn kho rồi mới duyệt.
CREATE PROCEDURE dbo.sp_PlaceOrder
    @ReceiverName    NVARCHAR(100),
    @ReceiverPhone   VARCHAR(15),
    @ShippingAddress NVARCHAR(600),
    @PaymentMethod   VARCHAR(15),
    @CustomerId      INT           = NULL,   -- NULL = khách vãng lai (chưa đăng nhập)
    @PromoCode       VARCHAR(30)   = NULL,
    @Note            NVARCHAR(500) = NULL,
    @ItemsJson       NVARCHAR(MAX) = NULL,   -- [{"productId":1,"qty":2}] cho khách vãng lai; NULL = dùng giỏ trong DB của @CustomerId
    @AutoApprove     BIT           = 1,
    @ReceiverEmail   VARCHAR(150)  = NULL,   -- email nhận mã đơn / thông báo (khách vãng lai bắt buộc nhập ở tầng ứng dụng)
    @OrderId         INT           OUTPUT,
    @OrderStatus     VARCHAR(10)   = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @CartId INT = NULL, @ItemCount INT, @Affected INT, @TotalQty INT;
    DECLARE @Subtotal DECIMAL(18,0), @Discount DECIMAL(18,0) = 0, @Ship DECIMAL(18,0);
    DECLARE @PromoId INT = NULL, @PType VARCHAR(10), @PVal DECIMAL(18,2), @PMax DECIMAL(18,0);
    DECLARE @Seq INT, @SeqStr VARCHAR(10), @OrderNo VARCHAR(20), @AuditAccountId INT = NULL;

    SET @ReceiverName    = LTRIM(RTRIM(ISNULL(@ReceiverName, N'')));
    SET @ReceiverPhone   = LTRIM(RTRIM(ISNULL(@ReceiverPhone, '')));
    SET @ShippingAddress = LTRIM(RTRIM(ISNULL(@ShippingAddress, N'')));
    IF LEN(@ReceiverName) = 0 OR LEN(@ReceiverPhone) = 0 OR LEN(@ShippingAddress) = 0
        THROW 50025, N'Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.', 1;
    IF @PaymentMethod NOT IN ('COD', 'BankTransfer', 'Card', 'Installment')
        THROW 50026, N'Phương thức thanh toán không hợp lệ.', 1;

    -- Chống đặt hàng ảo để "giữ" tồn kho (khách vãng lai đặt không cần đăng nhập):
    -- mỗi SĐT tối đa 3 đơn đang chờ kiểm tra hàng và 10 đơn trong 24 giờ.
    IF (SELECT COUNT(*) FROM dbo.Orders WHERE ReceiverPhone = @ReceiverPhone AND Status = 'Pending') >= 3
        THROW 50070, N'Số điện thoại này đang có 3 đơn chờ kiểm tra hàng. Vui lòng đợi nhân viên xác nhận hoặc huỷ bớt đơn cũ trước khi đặt thêm.', 1;
    IF (SELECT COUNT(*) FROM dbo.Orders WHERE ReceiverPhone = @ReceiverPhone AND CreatedAt >= DATEADD(HOUR, -24, SYSDATETIME())) >= 10
        THROW 50071, N'Số điện thoại này đã đặt quá 10 đơn trong 24 giờ. Vui lòng liên hệ hotline nếu bạn cần đặt số lượng lớn.', 1;

    -- SAO CHỤP toàn bộ dòng hàng (+ giá/tồn sản phẩm liên quan, có khoá) NGAY TỪ ĐẦU giao dịch vào #Cart,
    -- rồi dùng DUY NHẤT bảng tạm này cho phần còn lại (giữ tồn, tính tiền, tạo chi tiết đơn) để các lần đọc không lệch nhau.
    CREATE TABLE #Cart (ProductId INT NOT NULL PRIMARY KEY, Quantity INT NOT NULL, SalePrice DECIMAL(18,0) NOT NULL,
                        CostPrice DECIMAL(18,0) NOT NULL, WarrantyMonths INT NOT NULL, IsActive BIT NOT NULL);

    IF @ItemsJson IS NOT NULL
    BEGIN
        IF ISJSON(@ItemsJson) = 0 THROW 50020, N'Giỏ hàng trống.', 1;
        DECLARE @Req TABLE (ProductId INT PRIMARY KEY, Quantity INT NOT NULL);
        INSERT INTO @Req (ProductId, Quantity)
        SELECT j.ProductId, CASE WHEN SUM(j.Quantity) > 99 THEN 99 ELSE SUM(j.Quantity) END
        FROM OPENJSON(@ItemsJson) WITH (ProductId INT '$.productId', Quantity INT '$.qty') j
        WHERE j.ProductId IS NOT NULL AND j.Quantity > 0
        GROUP BY j.ProductId;
        INSERT INTO #Cart (ProductId, Quantity, SalePrice, CostPrice, WarrantyMonths, IsActive)
        SELECT r.ProductId, r.Quantity, p.SalePrice, p.CostPrice, p.WarrantyMonths, p.IsActive
        FROM @Req r JOIN dbo.Products p WITH (UPDLOCK, HOLDLOCK) ON p.ProductId = r.ProductId;
        IF (SELECT COUNT(*) FROM @Req) <> (SELECT COUNT(*) FROM #Cart)
            THROW 50023, N'Giỏ hàng có sản phẩm không còn tồn tại.', 1;
    END
    ELSE
    BEGIN
        IF @CustomerId IS NULL THROW 50020, N'Giỏ hàng trống.', 1;
        -- Khoá giỏ cho đến khi transaction đặt hàng kết thúc.
        SELECT @CartId = CartId FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK) WHERE CustomerId = @CustomerId;
        IF @CartId IS NULL THROW 50020, N'Giỏ hàng trống.', 1;
        INSERT INTO #Cart (ProductId, Quantity, SalePrice, CostPrice, WarrantyMonths, IsActive)
        SELECT ci.ProductId, ci.Quantity, p.SalePrice, p.CostPrice, p.WarrantyMonths, p.IsActive
        FROM dbo.CartItems ci
        JOIN dbo.Products p WITH (UPDLOCK, HOLDLOCK) ON p.ProductId = ci.ProductId
        WHERE ci.CartId = @CartId;
    END

    SELECT @ItemCount = COUNT(*), @TotalQty = ISNULL(SUM(Quantity), 0) FROM #Cart;
    IF @ItemCount = 0 THROW 50020, N'Giỏ hàng trống.', 1;

    IF EXISTS (SELECT 1 FROM #Cart WHERE IsActive = 0)
        THROW 50023, N'Giỏ hàng có sản phẩm đã ngừng bán.', 1;

    -- Giữ chỗ tồn kho: chỉ cập nhật được nếu tồn có thể bán >= số lượng đặt
    UPDATE p SET p.QtyReserved = p.QtyReserved + t.Quantity, p.UpdatedAt = SYSDATETIME()
    FROM dbo.Products p
    JOIN #Cart t ON t.ProductId = p.ProductId
    WHERE (p.QtyOnHand - p.QtyReserved) >= t.Quantity;
    SET @Affected = @@ROWCOUNT;
    IF @Affected <> @ItemCount THROW 50021, N'Một số sản phẩm không đủ tồn kho.', 1;

    SELECT @Subtotal = SUM(Quantity * SalePrice) FROM #Cart;

    IF @PromoCode IS NOT NULL AND LEN(@PromoCode) > 0
    BEGIN
        SELECT @PromoId = PromotionId, @PType = DiscountType, @PVal = DiscountValue, @PMax = MaxDiscount
        FROM dbo.Promotions WITH (UPDLOCK)
        WHERE Code = @PromoCode AND IsActive = 1
          AND SYSDATETIME() BETWEEN StartDate AND EndDate
          AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
          AND @Subtotal >= MinOrderAmount;
        IF @PromoId IS NULL THROW 50022, N'Mã khuyến mãi không hợp lệ hoặc không đủ điều kiện.', 1;

        SET @Discount = CASE WHEN @PType = 'Percent' THEN ROUND(@Subtotal * @PVal / 100, 0) ELSE @PVal END;
        IF @PType = 'Percent' AND @PMax IS NOT NULL AND @Discount > @PMax SET @Discount = @PMax;
        IF @Discount > @Subtotal SET @Discount = @Subtotal;

        UPDATE dbo.Promotions SET UsedCount = UsedCount + 1 WHERE PromotionId = @PromoId;
    END

    SET @Ship = CASE WHEN @Subtotal >= 5000000 THEN 0 ELSE 30000 END;   -- miễn phí ship từ 5 triệu

    -- Khách chưa đăng nhập: gắn vào hồ sơ khách vãng lai theo SĐT (chưa có thì tạo mới) để vẫn có hoá đơn / bảo hành / điểm thưởng.
    IF @CustomerId IS NULL
    BEGIN
        SELECT @CustomerId = CustomerId FROM dbo.Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE Phone = @ReceiverPhone AND AccountId IS NULL;
        IF @CustomerId IS NULL
        BEGIN
            INSERT INTO dbo.Customers (AccountId, FullName, Phone)
            VALUES (NULL, @ReceiverName,
                    CASE WHEN EXISTS (SELECT 1 FROM dbo.Customers WHERE Phone = @ReceiverPhone) THEN NULL ELSE @ReceiverPhone END);
            SET @CustomerId = CAST(SCOPE_IDENTITY() AS INT);
        END
    END
    ELSE
        SELECT @AuditAccountId = AccountId FROM dbo.Customers WHERE CustomerId = @CustomerId;

    SELECT @Seq = NEXT VALUE FOR dbo.sq_OrderNo;
    SET @SeqStr = CAST(@Seq AS VARCHAR(10));
    -- Đệm 0 tới tối thiểu 5 ký tự, KHÔNG BAO GIỜ cắt bớt số (tránh trùng mã khi sequence vượt 99999 trong cùng kỳ yyMM).
    SET @OrderNo = 'DH' + FORMAT(SYSDATETIME(), 'yyMM') + '-' + RIGHT(REPLICATE('0', 5) + @SeqStr, CASE WHEN LEN(@SeqStr) > 5 THEN LEN(@SeqStr) ELSE 5 END);

    INSERT INTO dbo.Orders (OrderNo, CustomerId, PromotionId, Status, PaymentMethod, PaymentStatus, ReceiverName, ReceiverPhone, ReceiverEmail,
                            ShippingAddress, Subtotal, DiscountAmount, ShippingFee, Note)
    VALUES (@OrderNo, @CustomerId, @PromoId, 'Pending', @PaymentMethod, 'Pending', @ReceiverName, @ReceiverPhone, NULLIF(LTRIM(RTRIM(@ReceiverEmail)), ''),
            @ShippingAddress, @Subtotal, @Discount, @Ship, @Note);
    SET @OrderId = CAST(SCOPE_IDENTITY() AS INT);

    INSERT INTO dbo.OrderDetails (OrderId, ProductId, Quantity, UnitPrice, CostPrice, WarrantyMonths)
    SELECT @OrderId, ProductId, Quantity, SalePrice, CostPrice, WarrantyMonths FROM #Cart;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AuditAccountId, 'CREATE', 'Order', CAST(@OrderId AS VARCHAR(50)),
            CASE WHEN @AuditAccountId IS NULL THEN N'Khách vãng lai đặt hàng' ELSE N'Khách đặt hàng' END);

    IF @CartId IS NOT NULL
    BEGIN
        DELETE FROM dbo.CartItems WHERE CartId = @CartId;
        UPDATE dbo.Carts SET UpdatedAt = SYSDATETIME() WHERE CartId = @CartId;
    END

    SET @OrderStatus = 'Pending';
    -- Tự xác nhận đơn 1 sản phẩm: chỉ khi hệ thống còn đủ Serial "Trong kho" cho dòng hàng đó (nếu thiếu, để nhân viên kiểm tra).
    IF @AutoApprove = 1 AND @TotalQty = 1
       AND EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeCode = 'NV000')
       AND NOT EXISTS (
            SELECT 1 FROM #Cart c JOIN dbo.Products p ON p.ProductId = c.ProductId
            WHERE p.IsSerialTracked = 1
              AND (SELECT COUNT(*) FROM dbo.ProductSerials s WHERE s.ProductId = c.ProductId AND s.Status = 'InStock') < c.Quantity)
    BEGIN
        EXEC dbo.sp_ApproveOrder @OrderId = @OrderId, @AccountId = NULL, @Auto = 1;
        SET @OrderStatus = 'Approved';
    END

    DROP TABLE #Cart;
    COMMIT TRAN;
END
GO

-- Giữ tên cũ cho dữ liệu mẫu / mã cũ: đặt hàng từ giỏ trong DB + địa chỉ đã lưu, KHÔNG tự xác nhận (để seed tự điều khiển trạng thái).
CREATE PROCEDURE dbo.sp_PlaceOrderFromCart
    @CustomerId    INT,
    @AddressId     INT,
    @PaymentMethod VARCHAR(15),
    @PromoCode     VARCHAR(30)   = NULL,
    @Note          NVARCHAR(500) = NULL,
    @OrderId       INT           OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RName NVARCHAR(100), @RPhone VARCHAR(15), @Addr NVARCHAR(600);
    SELECT @RName = ReceiverName, @RPhone = ReceiverPhone,
           @Addr = CONCAT_WS(N', ', AddressLine, Ward, District, Province)
    FROM dbo.CustomerAddresses WHERE AddressId = @AddressId AND CustomerId = @CustomerId;
    IF @RName IS NULL THROW 50024, N'Địa chỉ giao hàng không hợp lệ.', 1;

    EXEC dbo.sp_PlaceOrder @ReceiverName = @RName, @ReceiverPhone = @RPhone, @ShippingAddress = @Addr,
                           @PaymentMethod = @PaymentMethod, @CustomerId = @CustomerId, @PromoCode = @PromoCode,
                           @Note = @Note, @AutoApprove = 0, @OrderId = @OrderId OUTPUT;
END
GO

/* ---------- STORED PROCEDURE: DUYỆT ĐƠN ---------- */
-- Pending ("Đang kiểm tra hàng") -> Approved: trừ tồn thật, gán serial (FIFO), tạo bảo hành điện tử, ghi sổ kho, phát hành hoá đơn.
-- @Auto = 1: hệ thống tự xác nhận (đơn 1 sản phẩm, gọi từ sp_PlaceOrder) -> dùng nhân viên hệ thống NV000, không cần @AccountId.
CREATE PROCEDURE dbo.sp_ApproveOrder
    @OrderId   INT,
    @AccountId INT = NULL,
    @Auto      BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @EmployeeId INT, @Expected INT, @Assigned INT;
    DECLARE @Seq INT, @SeqStr VARCHAR(10), @InvoiceNo VARCHAR(20);

    IF @Auto = 1
    BEGIN
        SELECT @EmployeeId = EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV000';
        IF @EmployeeId IS NULL THROW 50039, N'Chưa cấu hình nhân viên hệ thống (NV000) để tự xác nhận đơn.', 1;
    END
    ELSE
    BEGIN
        SELECT @EmployeeId = e.EmployeeId
        FROM dbo.Employees e JOIN dbo.Accounts a ON a.AccountId = e.AccountId
        WHERE e.AccountId = @AccountId AND a.IsActive = 1;
        IF @EmployeeId IS NULL THROW 50030, N'Tài khoản không phải nhân viên hoặc đã bị khoá.', 1;
    END

    SELECT @Status = Status FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50031, N'Đơn hàng không tồn tại.', 1;
    IF @Status <> 'Pending' THROW 50032, N'Chỉ duyệt được đơn ở trạng thái Đang kiểm tra hàng.', 1;

    -- 1) Trừ tồn thực tế + bỏ giữ chỗ
    UPDATE p SET p.QtyOnHand = p.QtyOnHand - d.Quantity,
                 p.QtyReserved = p.QtyReserved - d.Quantity,
                 p.UpdatedAt = SYSDATETIME()
    FROM dbo.Products p
    JOIN dbo.OrderDetails d ON d.ProductId = p.ProductId
    WHERE d.OrderId = @OrderId;

    -- 2) Gán serial cho sản phẩm quản lý theo serial (lấy serial nhập sớm nhất)
    SELECT @Expected = ISNULL(SUM(d.Quantity), 0)
    FROM dbo.OrderDetails d JOIN dbo.Products p ON p.ProductId = d.ProductId
    WHERE d.OrderId = @OrderId AND p.IsSerialTracked = 1;

    ;WITH need AS (
        SELECT d.OrderDetailId, d.ProductId, d.Quantity
        FROM dbo.OrderDetails d JOIN dbo.Products p ON p.ProductId = d.ProductId
        WHERE d.OrderId = @OrderId AND p.IsSerialTracked = 1
    ),
    ranked AS (
        SELECT s.SerialId, s.ProductId,
               ROW_NUMBER() OVER (PARTITION BY s.ProductId ORDER BY s.SerialId) AS rn
        FROM dbo.ProductSerials s WITH (UPDLOCK)
        WHERE s.Status = 'InStock' AND s.ProductId IN (SELECT ProductId FROM need)
    )
    INSERT INTO dbo.OrderDetailSerials (OrderDetailId, SerialId)
    SELECT n.OrderDetailId, r.SerialId
    FROM need n JOIN ranked r ON r.ProductId = n.ProductId AND r.rn <= n.Quantity;
    SET @Assigned = @@ROWCOUNT;
    IF @Assigned <> @Expected THROW 50033, N'Không đủ Serial "Trong kho" để xuất cho đơn hàng.', 1;

    UPDATE s SET s.Status = 'Sold'
    FROM dbo.ProductSerials s
    JOIN dbo.OrderDetailSerials ods ON ods.SerialId = s.SerialId
    JOIN dbo.OrderDetails d ON d.OrderDetailId = ods.OrderDetailId
    WHERE d.OrderId = @OrderId;

    -- 3) Bảo hành điện tử
    INSERT INTO dbo.Warranties (SerialId, OrderDetailId, CustomerId, StartDate, EndDate)
    SELECT ods.SerialId, d.OrderDetailId, o.CustomerId,
           CAST(SYSDATETIME() AS DATE), DATEADD(MONTH, d.WarrantyMonths, CAST(SYSDATETIME() AS DATE))
    FROM dbo.OrderDetailSerials ods
    JOIN dbo.OrderDetails d ON d.OrderDetailId = ods.OrderDetailId
    JOIN dbo.Orders o ON o.OrderId = d.OrderId
    WHERE d.OrderId = @OrderId;

    -- 4) Sổ kho (ghi qua AuditLogs dùng chung)
    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    SELECT @AccountId, 'STOCK_OUT', 'Product', CAST(d.ProductId AS VARCHAR(50)),
           CONCAT(N'Xuất kho -', d.Quantity, N' khi duyệt đơn #', @OrderId)
    FROM dbo.OrderDetails d WHERE d.OrderId = @OrderId;

    -- 5) Hoá đơn
    SELECT @Seq = NEXT VALUE FOR dbo.sq_InvoiceNo;
    SET @SeqStr = CAST(@Seq AS VARCHAR(10));
    SET @InvoiceNo = 'HD' + FORMAT(SYSDATETIME(), 'yyMM') + '-' + RIGHT(REPLICATE('0', 5) + @SeqStr, CASE WHEN LEN(@SeqStr) > 5 THEN LEN(@SeqStr) ELSE 5 END);

    INSERT INTO dbo.Invoices (InvoiceNo, OrderId, IssuedByEmployee, BuyerName, BuyerCompany, BuyerTaxCode, BuyerAddress,
                              SubtotalAmount, DiscountAmount, VatAmount, TotalAmount)
    SELECT @InvoiceNo, o.OrderId, @EmployeeId, o.ReceiverName, c.CompanyName, c.TaxCode, o.ShippingAddress,
           o.Subtotal, o.DiscountAmount, o.VatAmount, o.TotalAmount
    FROM dbo.Orders o JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
    WHERE o.OrderId = @OrderId;

    -- 6) Đổi trạng thái đơn
    UPDATE dbo.Orders SET Status = 'Approved', SalesEmployeeId = @EmployeeId, ApprovedAt = SYSDATETIME()
    WHERE OrderId = @OrderId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'APPROVE', 'Order', CAST(@OrderId AS VARCHAR(50)),
            CASE WHEN @Auto = 1 THEN N'Hệ thống tự xác nhận đơn 1 sản phẩm (Pending -> Approved)'
                 ELSE N'Nhân viên duyệt đơn (Pending -> Approved)' END);

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: HUỶ ĐƠN ---------- */
-- Pending  -> Cancelled : nhả giữ chỗ tồn kho.
-- Approved -> Cancelled : TRẢ LẠI tồn kho, trả serial về "Trong kho", vô hiệu bảo hành + hoá đơn.
CREATE PROCEDURE dbo.sp_CancelOrder
    @OrderId   INT,
    @Reason    NVARCHAR(255),
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @PromoId INT, @PayStatus VARCHAR(13), @OrderCustomerId INT;
    SELECT @Status = Status, @PromoId = PromotionId, @PayStatus = PaymentStatus, @OrderCustomerId = CustomerId
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;

    IF @Status IS NULL THROW 50035, N'Đơn hàng không tồn tại.', 1;
    IF @Status IN ('Cancelled', 'Completed') THROW 50036, N'Không thể huỷ đơn đã huỷ hoặc đã hoàn tất.', 1;

    -- Chỉ cho huỷ nếu người thực hiện là CHÍNH khách đặt đơn (tài khoản đang đăng nhập),
    -- hoặc là nhân viên đang hoạt động (có quyền order.cancel được kiểm tra ở lớp ứng dụng/route).
    IF NOT EXISTS (SELECT 1 FROM dbo.Accounts a WHERE a.AccountId = @AccountId AND a.IsActive = 1)
        THROW 50037, N'Tài khoản thực hiện không hợp lệ hoặc đã bị khoá.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Customers c WHERE c.CustomerId = @OrderCustomerId AND c.AccountId = @AccountId)
       AND NOT EXISTS (SELECT 1 FROM dbo.Employees e WHERE e.AccountId = @AccountId)
        THROW 50038, N'Không có quyền huỷ đơn hàng này.', 1;
    -- Khách tự huỷ được đơn của mình khi đang kiểm tra hàng (Pending), hoặc đã xác nhận (Approved) nhưng CHƯA thanh toán
    -- (đơn 1 sản phẩm được hệ thống tự xác nhận ngay nên khách phải huỷ được). Đơn đã thanh toán / đã giao: liên hệ nhân viên.
    IF EXISTS (
        SELECT 1
        FROM dbo.Customers
        WHERE CustomerId = @OrderCustomerId
          AND AccountId = @AccountId
    )
    AND NOT (@Status = 'Pending' OR (@Status = 'Approved' AND @PayStatus <> 'Paid'))
        THROW 50064, N'Đơn đã thanh toán hoặc đã hoàn tất, vui lòng liên hệ nhân viên để được hỗ trợ huỷ/hoàn tiền.', 1;

    IF @Status = 'Pending'
    BEGIN
        UPDATE p SET p.QtyReserved = p.QtyReserved - d.Quantity, p.UpdatedAt = SYSDATETIME()
        FROM dbo.Products p JOIN dbo.OrderDetails d ON d.ProductId = p.ProductId
        WHERE d.OrderId = @OrderId;
    END
    ELSE   -- Approved
    BEGIN
        UPDATE p SET p.QtyOnHand = p.QtyOnHand + d.Quantity, p.UpdatedAt = SYSDATETIME()
        FROM dbo.Products p JOIN dbo.OrderDetails d ON d.ProductId = p.ProductId
        WHERE d.OrderId = @OrderId;

        INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
        SELECT @AccountId, 'STOCK_IN', 'Product', CAST(d.ProductId AS VARCHAR(50)),
               CONCAT(N'Trả kho +', d.Quantity, N' do huỷ đơn #', @OrderId)
        FROM dbo.OrderDetails d WHERE d.OrderId = @OrderId;

        UPDATE s SET s.Status = 'InStock'
        FROM dbo.ProductSerials s
        JOIN dbo.OrderDetailSerials ods ON ods.SerialId = s.SerialId
        JOIN dbo.OrderDetails d ON d.OrderDetailId = ods.OrderDetailId
        WHERE d.OrderId = @OrderId;

        UPDATE w SET w.Status = 'Voided'
        FROM dbo.Warranties w
        JOIN dbo.OrderDetails d ON d.OrderDetailId = w.OrderDetailId
        WHERE d.OrderId = @OrderId;

        DELETE ods
        FROM dbo.OrderDetailSerials ods
        JOIN dbo.OrderDetails d ON d.OrderDetailId = ods.OrderDetailId
        WHERE d.OrderId = @OrderId;

        UPDATE dbo.Invoices SET Status = 'Voided' WHERE OrderId = @OrderId;
    END

    IF @PromoId IS NOT NULL
        UPDATE dbo.Promotions SET UsedCount = UsedCount - 1 WHERE PromotionId = @PromoId AND UsedCount > 0;

    -- Đơn đã thu tiền (Paid) chỉ chuyển sang RefundPending (CHỜ hoàn tiền), KHÔNG tự coi là đã hoàn tiền.
    -- Phải gọi sp_ConfirmRefund sau khi đã thực sự chuyển tiền lại cho khách thì mới chuyển Refunded.
    UPDATE dbo.Orders
    SET Status = 'Cancelled', CancelReason = @Reason, CancelledAt = SYSDATETIME(),
        PaymentStatus = CASE WHEN PaymentStatus = 'Paid' THEN 'RefundPending' ELSE PaymentStatus END
    WHERE OrderId = @OrderId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'CANCEL', 'Order', CAST(@OrderId AS VARCHAR(50)),
            CONCAT(@Status, N' -> Cancelled: ', @Reason,
                   CASE WHEN @PayStatus = 'Paid' THEN N' (chờ hoàn tiền)' ELSE N'' END));

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: XÁC NHẬN ĐÃ HOÀN TIỀN ---------- */
-- RefundPending -> Refunded: gọi SAU KHI đã thực sự chuyển tiền lại cho khách (chuyển khoản/tiền mặt).
-- Tách biệt khỏi sp_CancelOrder để không tự động coi "huỷ đơn Paid" là "đã hoàn tiền xong" (đúng vấn đề #1 trong báo cáo rà soát).
CREATE PROCEDURE dbo.sp_ConfirmRefund
    @OrderId   INT,
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @PayStatus VARCHAR(13);

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE AccountId = @AccountId)
        THROW 50050, N'Chỉ nhân viên mới được xác nhận hoàn tiền.', 1;

    SELECT @Status = Status, @PayStatus = PaymentStatus
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50051, N'Đơn hàng không tồn tại.', 1;
    IF @Status <> 'Cancelled' OR @PayStatus <> 'RefundPending'
        THROW 50052, N'Đơn hàng không ở trạng thái chờ hoàn tiền.', 1;

    UPDATE dbo.Orders SET PaymentStatus = 'Refunded' WHERE OrderId = @OrderId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'REFUND', 'Order', CAST(@OrderId AS VARCHAR(50)), N'Xác nhận đã hoàn tiền cho khách (RefundPending -> Refunded)');

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: XÁC NHẬN THANH TOÁN TRƯỚC ---------- */
-- Dùng cho đơn thanh toán trước (BankTransfer/Card/Installment): Pending/Approved + PaymentStatus Pending -> Paid.
-- Đơn COD không gọi thủ tục này; tiền COD được xác nhận cùng lúc với sp_CompleteOrder (giao hàng thu tiền).
CREATE PROCEDURE dbo.sp_ConfirmPayment
    @OrderId   INT,
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @PayStatus VARCHAR(13), @Method VARCHAR(15);

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE AccountId = @AccountId)
        THROW 50053, N'Chỉ nhân viên mới được xác nhận thanh toán.', 1;

    SELECT @Status = Status, @PayStatus = PaymentStatus, @Method = PaymentMethod
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50054, N'Đơn hàng không tồn tại.', 1;
    IF @Status NOT IN ('Pending', 'Approved') THROW 50055, N'Đơn hàng không ở trạng thái có thể xác nhận thanh toán.', 1;
    IF @Method = 'COD' THROW 50056, N'Đơn COD không xác nhận thanh toán trước; chỉ xác nhận khi giao hàng.', 1;
    IF @PayStatus <> 'Pending' THROW 50057, N'Đơn hàng không ở trạng thái chờ thanh toán.', 1;

    UPDATE dbo.Orders SET PaymentStatus = 'Paid', PaidAt = SYSDATETIME() WHERE OrderId = @OrderId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'PAYMENT', 'Order', CAST(@OrderId AS VARCHAR(50)), N'Xác nhận đã thanh toán (Pending -> Paid)');

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: HOÀN TẤT ĐƠN (GIAO HÀNG THÀNH CÔNG) ---------- */
-- Approved -> Completed: đơn COD thu tiền lúc giao (tự chuyển PaymentStatus Paid); đơn thanh toán trước
-- BẮT BUỘC đã Paid từ trước (qua sp_ConfirmPayment) mới được hoàn tất. Khi hoàn tất, cộng điểm thành viên
-- và cập nhật hạng theo mốc điểm đã chốt trong MembershipTiers.
CREATE PROCEDURE dbo.sp_CompleteOrder
    @OrderId   INT,
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @PayStatus VARCHAR(13), @Method VARCHAR(15);
    DECLARE @CustomerId INT, @TotalAmount DECIMAL(18,0), @EarnedPoints INT, @NewPoints INT, @NewTierId INT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE AccountId = @AccountId)
        THROW 50060, N'Chỉ nhân viên mới được xác nhận hoàn tất đơn.', 1;

    SELECT @Status = Status, @PayStatus = PaymentStatus, @Method = PaymentMethod,
           @CustomerId = CustomerId, @TotalAmount = TotalAmount
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50061, N'Đơn hàng không tồn tại.', 1;
    IF @Status <> 'Approved' THROW 50062, N'Chỉ hoàn tất được đơn ở trạng thái Đã duyệt.', 1;
    IF @Method <> 'COD' AND @PayStatus <> 'Paid'
        THROW 50063, N'Đơn thanh toán trước phải xác nhận đã thanh toán trước khi hoàn tất.', 1;

    UPDATE dbo.Orders
    SET Status = 'Completed', CompletedAt = SYSDATETIME(),
        PaymentStatus = 'Paid',
        PaidAt = CASE WHEN PaymentStatus = 'Paid' THEN PaidAt ELSE SYSDATETIME() END
    WHERE OrderId = @OrderId;

    -- Tích điểm thành viên: 1 điểm mỗi 100.000đ thanh toán; cập nhật hạng theo mốc điểm (MembershipTiers.MinPoints) đã chốt.
    SET @EarnedPoints = CAST(FLOOR(@TotalAmount / 100000.0) AS INT);
    UPDATE dbo.Customers SET LoyaltyPoints = LoyaltyPoints + @EarnedPoints WHERE CustomerId = @CustomerId;
    SELECT @NewPoints = LoyaltyPoints FROM dbo.Customers WHERE CustomerId = @CustomerId;
    SELECT @NewTierId = MAX(TierId) FROM dbo.MembershipTiers WHERE MinPoints <= @NewPoints;
    IF @NewTierId IS NOT NULL
        UPDATE dbo.Customers SET TierId = @NewTierId WHERE CustomerId = @CustomerId AND TierId <> @NewTierId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'COMPLETE', 'Order', CAST(@OrderId AS VARCHAR(50)),
            CONCAT(N'Giao hàng thành công (Approved -> Completed), cộng ', @EarnedPoints, N' điểm thành viên'));

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: TỰ HUỶ ĐƠN CHỜ QUÁ HẠN ---------- */
-- Đơn "Đang kiểm tra hàng" (Pending) quá @Hours giờ mà chưa được nhân viên xác nhận thì hệ thống tự huỷ để NHẢ hàng giữ chỗ
-- (qua sp_CancelOrder, người thực hiện = tài khoản hệ thống NV000). Ứng dụng gọi định kỳ (xem src/server.js).
CREATE PROCEDURE dbo.sp_ExpirePendingOrders
    @Hours     INT = 48,
    @Cancelled INT = 0 OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @Cancelled = 0;
    DECLARE @sys INT = (SELECT a.AccountId FROM dbo.Employees e JOIN dbo.Accounts a ON a.AccountId = e.AccountId WHERE e.EmployeeCode = 'NV000');
    IF @sys IS NULL OR @Hours IS NULL OR @Hours < 1 RETURN;

    DECLARE @id INT, @reason NVARCHAR(255) = CONCAT(N'Tự huỷ: quá ', @Hours, N' giờ chưa được xác nhận nên hệ thống nhả hàng giữ chỗ.');
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR
        SELECT OrderId FROM dbo.Orders WHERE Status = 'Pending' AND CreatedAt < DATEADD(HOUR, -@Hours, SYSDATETIME());
    OPEN c; FETCH NEXT FROM c INTO @id;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            EXEC dbo.sp_CancelOrder @OrderId = @id, @Reason = @reason, @AccountId = @sys;
            SET @Cancelled += 1;
        END TRY
        BEGIN CATCH
            IF XACT_STATE() <> 0 ROLLBACK TRAN;   -- đơn lỗi thì bỏ qua, các đơn khác vẫn được xử lý
        END CATCH
        FETCH NEXT FROM c INTO @id;
    END
    CLOSE c; DEALLOCATE c;
END
GO
