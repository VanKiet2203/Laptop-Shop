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
        p.CategoryId, c.CategoryName, c.ParentId AS CategoryParentId,
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
CREATE VIEW dbo.vw_ProductSales
AS
SELECT  p.ProductId, p.Sku, p.ProductName, c.CategoryName, b.BrandName,
        SUM(d.Quantity)                              AS QtySold,
        SUM(d.LineTotal)                             AS SalesAmount,
        SUM(d.LineTotal - d.Quantity * d.CostPrice)  AS GrossProfit
FROM    dbo.OrderDetails d
JOIN    dbo.Orders o     ON o.OrderId = d.OrderId AND o.Status IN ('Approved','Completed')
JOIN    dbo.Products p   ON p.ProductId = d.ProductId
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
    @ReceiptId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10);
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
    SELECT NULL, 'STOCK_IN', 'Product', CAST(d.ProductId AS VARCHAR(50)),
           CONCAT(N'Nhập kho +', d.Quantity, N' theo phiếu nhập #', @ReceiptId)
    FROM dbo.GoodsReceiptDetails d
    WHERE d.ReceiptId = @ReceiptId;

    UPDATE g SET g.Status = 'Posted',
                 g.TotalAmount = (SELECT SUM(LineTotal) FROM dbo.GoodsReceiptDetails WHERE ReceiptId = @ReceiptId),
                 g.DueDate = DATEADD(DAY, sp.PaymentTermDays, CAST(g.ReceiptDate AS DATE))
    FROM dbo.GoodsReceipts g
    JOIN dbo.Suppliers sp ON sp.SupplierId = g.SupplierId
    WHERE g.ReceiptId = @ReceiptId;

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: ĐẶT HÀNG TỪ GIỎ ---------- */
-- Tạo đơn Pending từ giỏ hàng của khách, GIỮ CHỖ tồn kho (QtyReserved), áp voucher, xoá giỏ.
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
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @CartId INT, @ItemCount INT, @Affected INT;
    DECLARE @Subtotal DECIMAL(18,0), @Discount DECIMAL(18,0) = 0, @Ship DECIMAL(18,0);
    DECLARE @PromoId INT = NULL, @PType VARCHAR(10), @PVal DECIMAL(18,2), @PMax DECIMAL(18,0);
    DECLARE @RName NVARCHAR(100), @RPhone VARCHAR(15), @Addr NVARCHAR(400);
    DECLARE @Seq INT, @OrderNo VARCHAR(20);

    SELECT @CartId = CartId FROM dbo.Carts WHERE CustomerId = @CustomerId;
    SELECT @ItemCount = COUNT(*) FROM dbo.CartItems WHERE CartId = @CartId;
    IF @CartId IS NULL OR @ItemCount = 0 THROW 50020, N'Giỏ hàng trống.', 1;

    IF EXISTS (SELECT 1 FROM dbo.CartItems ci JOIN dbo.Products p ON p.ProductId = ci.ProductId
               WHERE ci.CartId = @CartId AND p.IsActive = 0)
        THROW 50023, N'Giỏ hàng có sản phẩm đã ngừng bán.', 1;

    SELECT @RName = ReceiverName, @RPhone = ReceiverPhone,
           @Addr = CONCAT_WS(N', ', AddressLine, Ward, District, Province)
    FROM dbo.CustomerAddresses WHERE AddressId = @AddressId AND CustomerId = @CustomerId;
    IF @RName IS NULL THROW 50024, N'Địa chỉ giao hàng không hợp lệ.', 1;

    -- Giữ chỗ tồn kho: chỉ cập nhật được nếu tồn có thể bán >= số lượng đặt
    UPDATE p SET p.QtyReserved = p.QtyReserved + ci.Quantity, p.UpdatedAt = SYSDATETIME()
    FROM dbo.Products p
    JOIN dbo.CartItems ci ON ci.ProductId = p.ProductId
    WHERE ci.CartId = @CartId AND (p.QtyOnHand - p.QtyReserved) >= ci.Quantity;
    SET @Affected = @@ROWCOUNT;
    IF @Affected <> @ItemCount THROW 50021, N'Một số sản phẩm không đủ tồn kho.', 1;

    SELECT @Subtotal = SUM(ci.Quantity * p.SalePrice)
    FROM dbo.CartItems ci JOIN dbo.Products p ON p.ProductId = ci.ProductId
    WHERE ci.CartId = @CartId;

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

    SELECT @Seq = NEXT VALUE FOR dbo.sq_OrderNo;
    SET @OrderNo = 'DH' + FORMAT(SYSDATETIME(), 'yyMM') + '-' + RIGHT('00000' + CAST(@Seq AS VARCHAR(10)), 5);

    INSERT INTO dbo.Orders (OrderNo, CustomerId, PromotionId, Status, PaymentMethod, PaymentStatus, ReceiverName, ReceiverPhone,
                            ShippingAddress, Subtotal, DiscountAmount, ShippingFee, Note)
    VALUES (@OrderNo, @CustomerId, @PromoId, 'Pending', @PaymentMethod, 'Pending', @RName, @RPhone,
            @Addr, @Subtotal, @Discount, @Ship, @Note);
    SET @OrderId = CAST(SCOPE_IDENTITY() AS INT);

    INSERT INTO dbo.OrderDetails (OrderId, ProductId, Quantity, UnitPrice, CostPrice, WarrantyMonths)
    SELECT @OrderId, ci.ProductId, ci.Quantity, p.SalePrice, p.CostPrice, p.WarrantyMonths
    FROM dbo.CartItems ci JOIN dbo.Products p ON p.ProductId = ci.ProductId
    WHERE ci.CartId = @CartId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    SELECT c.AccountId, 'CREATE', 'Order', CAST(@OrderId AS VARCHAR(50)), N'Khách đặt hàng'
    FROM dbo.Customers c WHERE c.CustomerId = @CustomerId;

    DELETE FROM dbo.CartItems WHERE CartId = @CartId;
    UPDATE dbo.Carts SET UpdatedAt = SYSDATETIME() WHERE CartId = @CartId;

    COMMIT TRAN;
END
GO

/* ---------- STORED PROCEDURE: DUYỆT ĐƠN ---------- */
-- Pending -> Approved: trừ tồn thật, gán serial (FIFO), tạo bảo hành điện tử, ghi sổ kho, phát hành hoá đơn.
CREATE PROCEDURE dbo.sp_ApproveOrder
    @OrderId   INT,
    @AccountId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @EmployeeId INT, @Expected INT, @Assigned INT;
    DECLARE @Seq INT, @InvoiceNo VARCHAR(20);

    SELECT @EmployeeId = EmployeeId FROM dbo.Employees WHERE AccountId = @AccountId;
    IF @EmployeeId IS NULL THROW 50030, N'Tài khoản không phải nhân viên.', 1;

    SELECT @Status = Status FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50031, N'Đơn hàng không tồn tại.', 1;
    IF @Status <> 'Pending' THROW 50032, N'Chỉ duyệt được đơn ở trạng thái Chờ duyệt.', 1;

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
    SET @InvoiceNo = 'HD' + FORMAT(SYSDATETIME(), 'yyMM') + '-' + RIGHT('00000' + CAST(@Seq AS VARCHAR(10)), 5);

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
    VALUES (@AccountId, 'APPROVE', 'Order', CAST(@OrderId AS VARCHAR(50)), N'Nhân viên duyệt đơn (Pending -> Approved)');

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

    DECLARE @Status VARCHAR(10), @PromoId INT;
    SELECT @Status = Status, @PromoId = PromotionId
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;

    IF @Status IS NULL THROW 50035, N'Đơn hàng không tồn tại.', 1;
    IF @Status IN ('Cancelled', 'Completed') THROW 50036, N'Không thể huỷ đơn đã huỷ hoặc đã hoàn tất.', 1;

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

    UPDATE dbo.Orders
    SET Status = 'Cancelled', CancelReason = @Reason, CancelledAt = SYSDATETIME(),
        PaymentStatus = CASE WHEN PaymentStatus = 'Paid' THEN 'Refunded' ELSE PaymentStatus END
    WHERE OrderId = @OrderId;

    INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
    VALUES (@AccountId, 'CANCEL', 'Order', CAST(@OrderId AS VARCHAR(50)), CONCAT(@Status, N' -> Cancelled: ', @Reason));

    COMMIT TRAN;
END
GO
