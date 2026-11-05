/* =====================================================================
   MIGRATION: thêm phương thức thanh toán 'Stripe' cho DB ĐÃ TẠO TRƯỚC ĐÓ
   (DB tạo mới từ 01_schema.sql + 02_programmability.sql đã có sẵn, không cần chạy file này.)
   Chạy lại nhiều lần vẫn an toàn.
   ===================================================================== */
USE LaptopShopDB;
GO

/* 1. Cho phép PaymentMethod = 'Stripe' */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_Orders_Payment' AND definition LIKE N'%Stripe%')
BEGIN
    ALTER TABLE dbo.Orders DROP CONSTRAINT CK_Orders_Payment;
    ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_Payment
        CHECK (PaymentMethod IN ('COD','BankTransfer','Card','Installment','Cash','Stripe'));
END
GO

/* 2. sp_PlaceOrder: thêm 'Stripe' vào danh sách phương thức hợp lệ (sửa tại chỗ từ định nghĩa hiện có) */
DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID(N'dbo.sp_PlaceOrder'));
IF @def IS NOT NULL AND @def NOT LIKE N'%''Stripe''%'
BEGIN
    SET @def = REPLACE(@def, N'''Card'', ''Installment'')', N'''Card'', ''Installment'', ''Stripe'')');
    SET @def = STUFF(@def, CHARINDEX(N'CREATE', @def), 6, N'ALTER');
    EXEC sys.sp_executesql @def;
END
GO

/* 3. Thủ tục ghi nhận Stripe đã thu tiền (gọi từ webhook / trang quay về, không cần nhân viên) */
IF OBJECT_ID(N'dbo.sp_MarkPaidByGateway', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_MarkPaidByGateway;
GO
CREATE PROCEDURE dbo.sp_MarkPaidByGateway
    @OrderId    INT,
    @GatewayRef VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @Status VARCHAR(10), @PayStatus VARCHAR(13), @Method VARCHAR(15);

    SELECT @Status = Status, @PayStatus = PaymentStatus, @Method = PaymentMethod
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK) WHERE OrderId = @OrderId;
    IF @Status IS NULL THROW 50054, N'Đơn hàng không tồn tại.', 1;
    IF @Method <> 'Stripe' THROW 50056, N'Đơn hàng không thanh toán qua Stripe.', 1;

    IF @PayStatus = 'Pending'
    BEGIN
        UPDATE dbo.Orders
        SET PaymentStatus = CASE WHEN Status = 'Cancelled' THEN 'RefundPending' ELSE 'Paid' END,
            PaidAt = SYSDATETIME()
        WHERE OrderId = @OrderId;

        INSERT INTO dbo.AuditLogs (AccountId, Action, EntityName, EntityId, Detail)
        VALUES (NULL, 'PAYMENT', 'Order', CAST(@OrderId AS VARCHAR(50)),
                CASE WHEN @Status = 'Cancelled'
                     THEN N'Stripe đã thu tiền nhưng đơn đã huỷ (Pending -> RefundPending). Mã giao dịch: '
                     ELSE N'Stripe đã thu tiền (Pending -> Paid). Mã giao dịch: ' END + @GatewayRef);
    END

    COMMIT TRAN;
END
GO
