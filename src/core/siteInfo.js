// Thông tin doanh nghiệp (dữ liệu giả lập cho đồ án) - dùng cho footer, trang chính sách, mã QR chuyển khoản.
// Sửa ở đây là đổi toàn site; view đọc qua biến `site` (gắn trong core/locals.js).
module.exports = {
  name: 'Laptop Shop',
  legalName: 'Công ty TNHH Công nghệ Laptop Shop',
  taxCode: '0316 888 999',
  founded: 2016,
  hotline: '1900 6868',
  hotlineHours: '8:00 – 21:30 (kể cả Thứ 7, Chủ nhật)',
  email: 'cskh@laptopshop.vn',
  warrantyEmail: 'baohanh@laptopshop.vn',
  headOffice: '125 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  branches: [
    { name: 'Showroom Quận 5', address: '273 An Dương Vương, Phường 3, Quận 5, TP. Hồ Chí Minh', phone: '(028) 3835 6868' },
    { name: 'Showroom Hà Nội', address: '56 Thái Hà, Phường Trung Liệt, Quận Đống Đa, Hà Nội', phone: '(024) 3772 6868' },
    { name: 'Showroom Đà Nẵng', address: '210 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, Đà Nẵng', phone: '(0236) 3686 868' },
  ],
  socials: [
    { name: 'Facebook', icon: 'facebook', href: '#' },
    { name: 'YouTube', icon: 'youtube', href: '#' },
    { name: 'TikTok', icon: 'tiktok', href: '#' },
    { name: 'Zalo', icon: 'zalo', href: '#' },
  ],
  // Tài khoản nhận chuyển khoản (giả lập) - dùng tạo mã VietQR ở trang đơn hàng
  bank: { code: 'VCB', name: 'Vietcombank', account: '0071001234567', holder: 'CONG TY TNHH CONG NGHE LAPTOP SHOP' },
  paymentBadges: ['Visa', 'Mastercard', 'JCB', 'VietQR', 'COD'],
  // Trang thông tin tĩnh: /info/:slug
  pages: {
    've-chung-toi': {
      title: 'Về Laptop Shop',
      body: [
        'Laptop Shop được thành lập năm 2016 với mục tiêu đơn giản: giúp học sinh, sinh viên và dân văn phòng chọn đúng chiếc laptop và linh kiện phù hợp túi tiền.',
        'Mỗi sản phẩm bán ra đều được quản lý theo Serial/IMEI và có bảo hành điện tử, tra cứu bằng số Serial ngay trên website.',
        'Đội ngũ tư vấn kiểm tra chuẩn RAM/SSD tương thích trước khi bạn nâng cấp, để tránh mua nhầm linh kiện.',
      ],
    },
    'bao-hanh': {
      title: 'Chính sách bảo hành',
      body: [
        'Laptop chính hãng được bảo hành 12–24 tháng tuỳ sản phẩm; RAM, SSD bảo hành 36 tháng; phụ kiện 12–18 tháng.',
        'Bảo hành điện tử theo Serial: thời hạn được kích hoạt tự động khi đơn hàng được xác nhận, tra cứu bằng số Serial tại cửa hàng hoặc qua hotline.',
        'Không bảo hành với các trường hợp rơi vỡ, vào nước, tự ý can thiệp phần cứng hoặc tem bảo hành bị rách.',
      ],
    },
    'doi-tra': {
      title: 'Chính sách đổi trả',
      body: [
        'Đổi mới trong 7 ngày đầu nếu sản phẩm lỗi do nhà sản xuất (cần còn đủ hộp, phụ kiện và hoá đơn).',
        'Hoàn tiền trong 3–5 ngày làm việc kể từ khi nhân viên xác nhận đã nhận lại sản phẩm; đơn đã thanh toán sẽ được hoàn về đúng phương thức đã trả.',
        'Sản phẩm đã kích hoạt bảo hành điện tử và có dấu hiệu sử dụng sai cách sẽ không áp dụng đổi trả.',
      ],
    },
    'giao-hang': {
      title: 'Chính sách giao hàng',
      body: [
        'Miễn phí vận chuyển cho đơn từ 5.000.000 ₫; đơn dưới mức này phí cố định 30.000 ₫.',
        'Nội thành TP.HCM và Hà Nội giao trong 24 giờ; các tỉnh thành khác 2–4 ngày làm việc.',
        'Khách được kiểm tra ngoại quan sản phẩm khi nhận hàng. Với đơn COD, nhân viên sẽ gọi xác nhận trước khi giao.',
      ],
    },
    'thanh-toan': {
      title: 'Hướng dẫn thanh toán',
      body: [
        'COD: thanh toán tiền mặt khi nhận hàng, nhân viên sẽ gọi xác nhận đơn trước khi giao.',
        'Chuyển khoản: quét mã VietQR hiển thị sau khi đặt hàng, nội dung chuyển khoản là mã đơn hàng.',
        'Trả góp: qua thẻ tín dụng lãi suất 0% (kỳ hạn 6–12 tháng) hoặc công ty tài chính (kỳ hạn 6–24 tháng). Bạn có thể ước tính số tiền góp mỗi tháng ngay tại bước thanh toán.',
      ],
    },
    'bao-mat': {
      title: 'Chính sách bảo mật',
      body: [
        'Chúng tôi chỉ thu thập thông tin cần thiết để xử lý đơn hàng và bảo hành: họ tên, số điện thoại, địa chỉ nhận hàng và email (nếu có).',
        'Thông tin không được chia sẻ cho bên thứ ba ngoài đơn vị vận chuyển và cổng thanh toán phục vụ đơn hàng của bạn.',
        'Mật khẩu được mã hoá một chiều; bạn có thể yêu cầu xoá tài khoản bất cứ lúc nào qua email cskh@laptopshop.vn.',
      ],
    },
    'lien-he': {
      title: 'Liên hệ & hệ thống cửa hàng',
      body: [
        'Hotline 1900 6868 (8:00 – 21:30 mỗi ngày) · Email cskh@laptopshop.vn.',
        'Trụ sở: 125 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh.',
      ],
    },
  },
};
