/* =====================================================================
   MIGRATION: chặn nhân viên xác nhận tay đơn Stripe (chỉ Stripe mới được báo đã thu tiền)
   Dành cho DB ĐÃ TẠO TRƯỚC ĐÓ. Chạy lại nhiều lần vẫn an toàn.
   ===================================================================== */
USE LaptopShopDB;
GO

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID(N'dbo.sp_ConfirmPayment'));
IF @def IS NOT NULL AND @def NOT LIKE N'%@Method = ''Stripe''%'
BEGIN
    DECLARE @anchor NVARCHAR(200) = N'IF @PayStatus <> ''Pending'' THROW 50057';
    SET @def = REPLACE(@def, @anchor,
        N'IF @Method = ''Stripe'' THROW 50058, N''Đơn thanh toán qua Stripe được xác nhận tự động khi Stripe thu tiền, nhân viên không xác nhận thủ công.'', 1;' + CHAR(13) + CHAR(10) + N'    ' + @anchor);
    SET @def = STUFF(@def, CHARINDEX(N'CREATE', @def), 6, N'ALTER');
    EXEC sys.sp_executesql @def;
END
GO
