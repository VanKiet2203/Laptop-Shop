// Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Model = nơi DUY NHẤT chứa câu lệnh SQL của nhóm chức năng này (controller không viết SQL).
// Bảng / đối tượng DB liên quan: Warranties, ProductSerials, Customers
// Hàm gợi ý: lookup({serial, phone})
const db = require('../config/db');

// MODULE 4 - TRA CỨU BẢO HÀNH
// Model là nơi chứa câu lệnh SQL.
exports.lookup = ({ serial, phone } = {}) => {
  const serialValue = serial ? serial.trim() : null;
  const phoneValue = phone ? phone.trim() : null;

  return db.query(
    `SELECT
        w.WarrantyId,
        w.StartDate,
        w.EndDate,
        w.Status AS WarrantyStatus,
        ps.SerialNumber,
        p.ProductName,
        c.FullName AS CustomerName,
        c.Phone,
        o.OrderNo,
        o.CreatedAt AS PurchaseDate
     FROM dbo.Warranties AS w
     INNER JOIN dbo.ProductSerials AS ps
       ON ps.SerialId = w.SerialId
     INNER JOIN dbo.Products AS p
       ON p.ProductId = ps.ProductId
     INNER JOIN dbo.Customers AS c
       ON c.CustomerId = w.CustomerId
     INNER JOIN dbo.OrderDetails AS od
       ON od.OrderDetailId = w.OrderDetailId
     INNER JOIN dbo.Orders AS o
       ON o.OrderId = od.OrderId
     WHERE
       (@serial IS NULL OR ps.SerialNumber LIKE '%' + @serial + '%')
       AND (@phone IS NULL OR c.Phone LIKE '%' + @phone + '%')
     ORDER BY w.EndDate DESC`,
    {
      serial: serialValue,
      phone: phoneValue
    }
  );
};
