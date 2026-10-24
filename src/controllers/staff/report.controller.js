// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).

const Report = require('../../models/report.model');

// GET /staff/reports
// Báo cáo doanh thu theo ngày, tháng, năm.
exports.index = async (req, res) => {
  try {
    const { from, to, group } = req.query;

    const report = await Report.revenue({ from, to, group });
    const cards = await Report.dashboardCards();

    res.render('staff/reports/index', {
      title: 'Thống kê doanh thu',
      report,
      cards,
      from: report.from,
      to: report.to,
      group: report.group
    });
  } catch (error) {
    console.error('Lỗi báo cáo doanh thu:', error);
    res.status(500).send(
      'Không thể tải báo cáo doanh thu. Vui lòng kiểm tra kết nối database và cấu trúc view.'
    );
  }
};

// GET /staff/reports/products
// Danh sách sản phẩm bán chạy.
exports.products = async (req, res) => {
  try {
    const { from, to, limit } = req.query;

    const report = await Report.topProducts({ from, to, limit });

    res.render('staff/reports/products', {
      title: 'Sản phẩm bán chạy',
      report,
      from: report.from,
      to: report.to,
      limit: [10, 20, 50].includes(Number(limit))
        ? Number(limit)
        : 10
    });
  } catch (error) {
    console.error('Lỗi báo cáo sản phẩm:', error);
    res.status(500).send(
      'Không thể tải báo cáo sản phẩm. Vui lòng kiểm tra kết nối database và cấu trúc view.'
    );
  }
};
