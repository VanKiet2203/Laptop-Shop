// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const Warranty = require('../../models/warranty.model');

// GET /staff/warranty
exports.lookup = async (req, res) => {
  try {
    const serial = req.query.serial || '';
    const phone = req.query.phone || '';

    let warranties = [];

    if (serial.trim() || phone.trim()) {
      warranties = await Warranty.lookup({ serial, phone });
    }

    res.render('staff/warranty/index', {
      title: 'Tra cứu bảo hành',
      warranties,
      serial,
      phone
    });
  } catch (error) {
    console.error('Lỗi tra cứu bảo hành:', error);
    res.status(500).send('Không thể tra cứu bảo hành. Vui lòng thử lại.');
  }
};
