// Dựng báo cáo đồ án PTTK HTTT (.docx). Chạy:
//   NODE_PATH=<thư mục chứa node_modules có docx> node tools/build_report.js <dict.json> <out.docx>
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, BorderStyle, ShadingType, PageOrientation, Footer, PageNumber, TableOfContents,
  LevelFormat, PageBreak, VerticalAlign,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const DIA = path.join(ROOT, 'report', 'diagrams');
const SHOT = path.join(ROOT, 'report', 'shots');
const dict = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
dict.tables.filter((t) => t.name === 'Orders').forEach((t) => t.cols.forEach((c) => { if (c[0] === 'PaymentMethod') c[5] = 'COD / BankTransfer / Card / Installment / Cash / Stripe'; }));
const FONT = 'Times New Roman';

// ---------- kích thước trang (DXA) ----------
const PW = 11906, PH = 16838, ML = 1701, MR = 1134, MT = 1134, MB = 1134;
const WP = PW - ML - MR;          // bề rộng nội dung dọc  = 9071
const WL = PH - 1134 * 2;         // bề rộng nội dung ngang = 14570
const px = (dxa) => Math.round(dxa / 15);

// ---------- helper ----------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 26, ...o });
const P = (t, o = {}) => new Paragraph({
  spacing: { after: 120, line: 340 }, alignment: AlignmentType.JUSTIFIED, ...o.p,
  children: Array.isArray(t) ? t : [run(t, o.r)],
});
const H = (lvl, t) => new Paragraph({
  heading: lvl, keepNext: true, spacing: { before: lvl === HeadingLevel.HEADING_1 ? 360 : 240, after: 120 },
  children: [new TextRun({ text: t, font: FONT, bold: true, size: lvl === HeadingLevel.HEADING_1 ? 32 : lvl === HeadingLevel.HEADING_2 ? 28 : 26 })],
});
const H1 = (t) => H(HeadingLevel.HEADING_1, t), H2 = (t) => H(HeadingLevel.HEADING_2, t), H3 = (t) => H(HeadingLevel.HEADING_3, t);
const bullets = (items) => items.map((t) => new Paragraph({
  numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 320 }, alignment: AlignmentType.JUSTIFIED,
  children: Array.isArray(t) ? t : [run(t)],
}));
const numbered = (ref, items) => items.map((t) => new Paragraph({
  numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 320 }, alignment: AlignmentType.JUSTIFIED,
  children: Array.isArray(t) ? t : [run(t)],
}));
const cap = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [run(t, { italics: true, size: 24 })] });
const pb = () => new Paragraph({ children: [new PageBreak()] });

const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (t, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
  margins: { top: 50, bottom: 50, left: 90, right: 90 },
  shading: o.head ? { fill: 'D9E2F3', type: ShadingType.CLEAR, color: 'auto' } : undefined,
  children: (Array.isArray(t) ? t : [String(t)]).map((x) => new Paragraph({
    alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text: x, font: FONT, size: o.size || 22, bold: !!o.head })],
  })),
});
function table(head, rows, widths, o = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: sum, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, widths[i], { head: true, center: true, size: o.size })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { size: o.size, center: o.centerCols && o.centerCols.includes(i) })) })),
    ],
  });
}
function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function fig(file, caption, maxWDxa, maxHDxa) {
  const [w, h] = pngSize(file);
  let wp = px(maxWDxa), hp = Math.round((wp * h) / w);
  const mh = px(maxHDxa);
  if (hp > mh) { hp = mh; wp = Math.round((hp * w) / h); }
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 60, after: 40 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: wp, height: hp },
        altText: { title: caption, description: caption, name: caption } })] }),
    cap(caption),
  ];
}
const figP = (f, c, hmax = 11200) => fig(path.join(DIA, f), c, WP, hmax);
const figL = (f, c) => fig(path.join(DIA, f), c, WL, 8900);
const shot = (f, c) => fig(path.join(SHOT, f + '.png'), c, WP - 400, 6200);

// ---------- gom section ----------
const sections = [];
let cur = null;
function add(orient, ...kids) {
  if (!cur || cur.orient !== orient) { cur = { orient, kids: [] }; sections.push(cur); }
  cur.kids.push(...kids.flat());
}
const portrait = (...k) => add('p', ...k);
const landscape = (...k) => add('l', ...k);

// =====================================================================
// BÌA
// =====================================================================
const C = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 120 },
  children: [run(t, { bold: o.bold, size: o.size || 28 })] });
portrait(
  C('TRƯỜNG ĐẠI HỌC SÀI GÒN', { bold: true }),
  C('KHOA CÔNG NGHỆ THÔNG TIN', { bold: true, after: 600 }),
  C('BÁO CÁO ĐỒ ÁN GIỮA KỲ', { bold: true, size: 40, after: 120 }),
  C('HỌC PHẦN: PHÂN TÍCH THIẾT KẾ HỆ THỐNG THÔNG TIN', { bold: true, size: 30, after: 600 }),
  C('ĐỀ TÀI', { bold: true, size: 30 }),
  C('HỆ THỐNG QUẢN LÝ BÁN HÀNG LAPTOP & LINH KIỆN', { bold: true, size: 36, after: 120 }),
  C('(Website LaptopShop: Cửa hàng – Nhân viên bán hàng – Kho – Quản trị)', { size: 26, after: 700 }),
  P([run('Giảng viên hướng dẫn: ', { bold: true }), run('……………………………………………')], { p: { alignment: AlignmentType.LEFT } }),
  P([run('Nhóm thực hiện: ', { bold: true }), run('…… (do giảng viên quy định)')], { p: { alignment: AlignmentType.LEFT } }),
  P([run('Thành viên:', { bold: true })], { p: { alignment: AlignmentType.LEFT } }),
  table(['STT', 'MSSV', 'Họ và tên', 'Module phụ trách'], [
    ['1', '………………', '……………………………', 'Module 1 – Hệ thống & Kho'],
    ['2', '………………', '……………………………', 'Module 2 – Danh mục & Cửa hàng'],
    ['3', '………………', '……………………………', 'Module 3 – Khách mua hàng'],
    ['4', '………………', '……………………………', 'Module 4 – Đơn hàng, hoá đơn & báo cáo'],
  ], [700, 1700, 3100, 3571], { centerCols: [0, 1] }),
  new Paragraph({ spacing: { before: 500 }, alignment: AlignmentType.CENTER, children: [run('TP. Hồ Chí Minh, năm 2026', { italics: true })] }),
  pb(),
);

// =====================================================================
// BẢNG PHÂN CÔNG + KẾ HOẠCH
// =====================================================================
portrait(
  H1('BẢNG PHÂN CÔNG VÀ KẾ HOẠCH LÀM VIỆC'),
  P('Nhóm chia hệ thống thành 4 module độc lập (route → controller → model → view), mỗi thành viên sở hữu một module và chỉ sửa các tệp thuộc module của mình; các tệp dùng chung (app.js, core, layouts, database/*.sql) chỉ sửa sau khi báo cả nhóm. Cột “Tỉ lệ (%)” do nhóm tự đánh giá khi nộp bản in; thành viên tham gia nhiều nhất được tính 100%.'),
  H3('Bảng phân công'),
  table(['STT', 'Họ tên', 'Công việc chính', 'Tỉ lệ (%)', 'Ký tên'], [
    ['1', '………………', 'Module 1: Đăng nhập/RBAC, quản lý tài khoản, vai trò & phân quyền, nhật ký; nhà cung cấp, phiếu nhập kho (Serial), tồn kho', '…', ''],
    ['2', '………………', 'Module 2: Trang chủ, danh sách/chi tiết sản phẩm, tìm kiếm – lọc – sắp xếp; CRUD sản phẩm, danh mục, thương hiệu, thuộc tính; gợi ý linh kiện tương thích', '…', ''],
    ['3', '………………', 'Module 3: Đăng ký, hồ sơ & sổ địa chỉ, giỏ hàng, thanh toán, đặt hàng, lịch sử đơn, huỷ đơn, tra cứu đơn vãng lai', '…', ''],
    ['4', '………………', 'Module 4: Duyệt/huỷ đơn, hoá đơn (xem/in), thống kê doanh thu, sản phẩm bán chạy, tra cứu bảo hành', '…', ''],
  ], [700, 1500, 4471, 1100, 1300], { centerCols: [0, 3] }),
  H3('Kế hoạch làm việc theo tuần'),
  table(['Tuần', 'Công việc', 'Kết quả'], [
    ['1–2', 'Khảo sát nghiệp vụ bán laptop & linh kiện; xác định tác nhân, chức năng; chia module', 'Danh sách yêu cầu, bảng phân công'],
    ['3–4', 'Phân tích: sơ đồ chức năng (BFD), sơ đồ ngữ cảnh, DFD mức đỉnh và dưới đỉnh', 'Bộ sơ đồ BFD/DFD'],
    ['5–6', 'Thiết kế CSDL: ERD, lược đồ quan hệ, từ điển dữ liệu; viết script tạo bảng, trigger, view, stored procedure', 'database/01_schema.sql, 02_programmability.sql'],
    ['7–8', 'Chuẩn bị dữ liệu mẫu và tài khoản kiểm thử; dựng khung ứng dụng Express/EJS, đăng nhập, phân quyền', 'database/03_seed.sql, khung MVC'],
    ['8–10', 'Lập trình 4 module song song theo nhánh module-1…module-4; kiểm thử tự động (node --test)', 'Mã nguồn các module, bộ test'],
    ['10', 'Tích hợp, kiểm thử luồng nghiệp vụ end-to-end (đặt → duyệt → hoá đơn → huỷ/hoàn kho; nhập kho)', 'Bản chạy ổn định'],
    ['11', 'Hoàn thiện báo cáo, chụp giao diện, hướng dẫn cài đặt; nộp bài và báo cáo', 'Báo cáo in + tệp nộp'],
  ], [900, 5371, 2800], { centerCols: [0] }),
  pb(),
  new Paragraph({ children: [new TextRun({ text: 'MỤC LỤC', font: FONT, bold: true, size: 32 })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
  new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-3' }),
  pb(),
);

// =====================================================================
// CHƯƠNG 1
// =====================================================================
portrait(
  H1('CHƯƠNG 1. GIỚI THIỆU HỆ THỐNG THÔNG TIN'),
  H2('1.1. Bài toán và phạm vi'),
  P('Đề tài xây dựng một phần của hệ thống thông tin cho một doanh nghiệp thương mại chuyên kinh doanh laptop, linh kiện (RAM, SSD…) và phụ kiện. Hệ thống được hiện thực dưới dạng website bán hàng LaptopShop với bốn khu vực làm việc tách biệt: Cửa hàng trực tuyến cho khách mua hàng (/), khu vực Nhân viên bán hàng (/staff), khu vực Nhân viên kho (/warehouse) và khu vực Quản trị hệ thống (/admin). Giao diện quản trị được tách riêng khỏi giao diện kho và bán hàng đúng theo yêu cầu của đồ án.'),
  P('Phạm vi đồ án bao phủ cả hai hướng nghiệp vụ mà đề bài cho phép chọn (A: Mua hàng và B: Nhập xuất kho) vì hai quy trình này liên thông với nhau thông qua tồn kho: hàng nhập kho làm tăng tồn, đơn hàng được duyệt làm giảm tồn, đơn bị huỷ hoàn trả tồn.'),

  H2('1.2. Mục tiêu xây dựng hệ thống'),
  ...bullets([
    'Số hoá quy trình bán hàng: khách tự xem, tìm, lọc sản phẩm, đặt hàng trực tuyến thay cho việc ghi nhận đơn thủ công.',
    'Quản lý chặt chẽ tồn kho theo từng mặt hàng và theo từng số Serial/IMEI, tránh bán trùng một Serial và bán vượt tồn.',
    'Tự động hoá các quy tắc nghiệp vụ: giữ chỗ tồn khi đặt, trừ tồn khi duyệt, hoàn tồn khi huỷ, phát hành hoá đơn và bảo hành điện tử khi duyệt đơn.',
    'Phân quyền theo vai trò (Quản trị, Bán hàng, Kho, Khách hàng) và ghi nhật ký mọi thao tác quan trọng để truy vết.',
    'Cung cấp thống kê doanh thu, sản phẩm bán chạy, cảnh báo sắp hết hàng cho người quản lý ra quyết định.',
  ]),

  H2('1.3. Các tác nhân của hệ thống'),
  table(['Tác nhân', 'Mô tả', 'Khu vực'], [
    ['Khách hàng', 'Người mua; có thể có tài khoản hoặc mua dưới dạng khách vãng lai (giỏ hàng lưu theo phiên)', '/ , /cart, /checkout, /orders, /account'],
    ['Nhân viên bán hàng', 'Quản lý sản phẩm, duyệt/huỷ đơn, in hoá đơn, tra cứu bảo hành, xem báo cáo, trả lời chat', '/staff'],
    ['Nhân viên kho', 'Quản lý nhà cung cấp, lập và chốt phiếu nhập, xem tồn kho, tra cứu Serial, xem sổ kho', '/warehouse'],
    ['Quản trị viên', 'Quản lý tài khoản, phân quyền vai trò, xem nhật ký hệ thống', '/admin'],
    ['Nhà cung cấp', 'Tác nhân ngoài, giao hàng và chứng từ cho kho; thông tin được lưu khi lập phiếu nhập', '(ngoài hệ thống)'],
    ['Cổng thanh toán Stripe', 'Tác nhân ngoài, nhận yêu cầu thanh toán thẻ và báo kết quả thu tiền về hệ thống (webhook hoặc trang quay về)', '(ngoài hệ thống)'],
  ], [2000, 4671, 2400]),

  H2('1.4. Chức năng của hệ thống'),
  H3('1.4.1. Quản trị hệ thống'),
  ...bullets(['Đăng nhập, đăng xuất, đổi mật khẩu, quên mật khẩu (liên kết dùng một lần, hết hạn sau 60 phút); đăng nhập bằng Google (tuỳ chọn).',
    'Quản lý tài khoản: thêm, sửa, khoá/mở khoá, đặt lại mật khẩu, xoá; lọc theo vai trò và trạng thái.',
    'Phân quyền: gán/bỏ quyền chi tiết (dạng module.action) cho từng vai trò; thay đổi có hiệu lực ngay ở request kế tiếp.',
    'Xem nhật ký hoạt động (ai làm gì, lúc nào, từ địa chỉ IP nào).']),
  H3('1.4.2. Mua hàng trực tuyến (Khách hàng)'),
  ...bullets(['Xem thông tin hàng hoá, tồn kho; tìm kiếm có gợi ý; lọc theo danh mục, thương hiệu, thuộc tính kỹ thuật, khoảng giá; sắp xếp theo tên/giá; phân trang.',
    'Xem chi tiết sản phẩm, gợi ý linh kiện tương thích (ví dụ RAM/SSD phù hợp với laptop đang xem).',
    'Giỏ hàng (kể cả khách vãng lai), chọn sản phẩm để thanh toán, áp mã khuyến mãi, chọn phương thức thanh toán (COD, chuyển khoản, thẻ qua Stripe).',
    'Đặt hàng, theo dõi trạng thái, huỷ đơn khi còn chờ; tra cứu đơn vãng lai theo mã đơn; quản lý hồ sơ và sổ địa chỉ giao hàng.',
    'Chat tư vấn với nhân viên; trợ lý AI tự trả lời khi nhân viên chưa phản hồi.']),
  H3('1.4.3. Quản lý bán hàng (Nhân viên bán hàng)'),
  ...bullets(['Thêm, sửa, xoá sản phẩm; quản lý danh mục nhiều cấp, thương hiệu, thuộc tính kỹ thuật.',
    'Duyệt đơn hàng (trừ tồn, gán Serial theo nguyên tắc nhập trước xuất trước, tạo hoá đơn và bảo hành), huỷ đơn (hoàn tồn, trả Serial, vô hiệu hoá đơn/bảo hành), xác nhận thanh toán, hoàn tất đơn, xác nhận hoàn tiền.',
    'Xem, in và lưu trữ hoá đơn bán hàng; xem hoá đơn theo khoảng thời gian tuỳ chọn.',
    'Thống kê doanh thu theo thời gian, sản phẩm bán chạy, lợi nhuận; tra cứu bảo hành theo Serial/số điện thoại.']),
  H3('1.4.4. Quản lý kho (Nhân viên kho)'),
  ...bullets(['Quản lý nhà cung cấp (thêm, sửa, xoá); tìm kiếm, sắp xếp.',
    'Lập phiếu nhập kho (trạng thái nháp), chốt phiếu (tăng tồn, ghi Serial), huỷ phiếu, in và lưu trữ phiếu nhập.',
    'Xem tồn kho theo sản phẩm (tồn thực, giữ chỗ, khả dụng, ngưỡng cảnh báo), tra cứu Serial, xem sổ kho/lịch sử nhập theo thời gian.']),

  H2('1.5. Dữ liệu vào – ra và xử lý'),
  table(['Chức năng', 'Dữ liệu vào', 'Xử lý', 'Dữ liệu ra'], [
    ['Đăng nhập', 'Tên đăng nhập, mật khẩu', 'So khớp băm bcrypt, kiểm tra tài khoản bị khoá, nạp quyền', 'Phiên đăng nhập, chuyển đúng khu vực theo vai trò'],
    ['Đặt hàng', 'Giỏ hàng, địa chỉ, phương thức thanh toán, mã giảm giá', 'sp_PlaceOrder: kiểm tra tồn khả dụng, tính tiền, giữ chỗ QtyReserved', 'Đơn hàng (Pending), email xác nhận'],
    ['Thanh toán thẻ', 'Mã đơn, kết quả thanh toán từ Stripe', 'Tạo phiên Stripe Checkout; khi Stripe báo đã thu tiền, sp_MarkPaidByGateway chuyển PaymentStatus sang Paid', 'Đơn đã thanh toán, email xác nhận'],
    ['Duyệt đơn', 'Mã đơn, nhân viên duyệt', 'sp_ApproveOrder: trừ QtyOnHand, gán Serial FIFO, tạo hoá đơn, bảo hành', 'Đơn Approved, hoá đơn, bảo hành điện tử'],
    ['Huỷ đơn', 'Mã đơn, lý do', 'sp_CancelOrder: nhả giữ chỗ hoặc hoàn tồn, trả Serial, vô hiệu hoá đơn/bảo hành', 'Đơn Cancelled, tồn kho cập nhật'],
    ['Nhập kho', 'Nhà cung cấp, sản phẩm, số lượng, đơn giá, số Serial', 'sp_PostGoodsReceipt: tăng tồn, ghi Serial InStock, cập nhật giá nhập', 'Phiếu nhập Posted, bản in phiếu'],
    ['Báo cáo', 'Khoảng thời gian', 'Tổng hợp qua view vw_SalesDaily, vw_ProductSales', 'Biểu đồ doanh thu, bảng sản phẩm bán chạy'],
  ], [1500, 2300, 3200, 2071], { size: 21 }),

  H2('1.6. Quy tắc nghiệp vụ chính'),
  ...numbered('num1', [
    'Đặt hàng chỉ giữ chỗ tồn (Products.QtyReserved); chỉ khi duyệt mới trừ tồn thực (QtyOnHand). Huỷ đơn chờ thì nhả giữ chỗ; huỷ đơn đã duyệt thì hoàn tồn, trả Serial, vô hiệu hoá đơn và bảo hành.',
    'Sản phẩm quản lý theo Serial (IsSerialTracked = 1): Serial được gán tự động khi duyệt đơn theo nguyên tắc nhập trước xuất trước; một Serial không bán hai lần.',
    'Đơn hàng có bốn trạng thái Pending → Approved → Completed hoặc Cancelled; thanh toán có bốn trạng thái Pending, Paid, RefundPending, Refunded. Chuyển trạng thái chỉ thực hiện qua stored procedure để tránh bỏ qua máy trạng thái. Đơn thanh toán qua Stripe chỉ chuyển sang Paid khi Stripe xác nhận đã thu tiền, nhân viên không xác nhận thủ công.',
    'Các cột tính toán VatAmount, TotalAmount, LineTotal không được ghi trực tiếp.',
    'Mọi thao tác ghi quan trọng đều ghi nhật ký (AuditLogs) trong cùng transaction; lỗi ghi nhật ký làm huỷ cả thao tác nghiệp vụ.',
  ]),

  H2('1.7. Công nghệ sử dụng'),
  table(['Thành phần', 'Công nghệ'], [
    ['Phần mềm', 'Website xây dựng bằng Node.js (Express), mô hình MVC'],
    ['Giao diện', 'EJS và Bootstrap 5'],
    ['Cơ sở dữ liệu', 'Microsoft SQL Server'],
    ['Thanh toán thẻ', 'Stripe Checkout (chế độ thử nghiệm)'],
  ], [2600, 6471]),
);

// =====================================================================
// CHƯƠNG 2 – PHÂN TÍCH
// =====================================================================
portrait(
  H1('CHƯƠNG 2. PHÂN TÍCH HỆ THỐNG'),
  P('Các sơ đồ trong chương này vẽ theo đúng quy ước của môn học: sơ đồ chức năng (BFD) là cây phân rã gồm các hình chữ nhật nối bằng đường thẳng, không có mũi tên; sơ đồ dòng dữ liệu (DFD) theo ký hiệu DeMarco & Yourdon: tiến trình là hình tròn có số thứ tự, kho dữ liệu là hai đường thẳng song song, đầu cuối là hình chữ nhật, dòng dữ liệu là mũi tên có nhãn. Tên tiến trình là cụm “động từ + bổ ngữ”, tên dòng dữ liệu và kho là cụm danh từ. Các tệp .drawio tương ứng được lưu trong thư mục report/diagrams để mở và chỉnh sửa bằng draw.io.'),
  H2('2.1. Sơ đồ chức năng (BFD)'),
  P('Hệ thống được phân rã thành bốn nhóm chức năng cấp 1 tương ứng với bốn khu vực làm việc; mỗi nhóm có các chức năng con ở cấp 2 như hình dưới.'),
);
landscape(...figL('bfd.png', 'Hình 2.1. Sơ đồ chức năng (BFD) của hệ thống'));
portrait(
  H2('2.2. Sơ đồ ngữ cảnh'),
  P('Sơ đồ ngữ cảnh chỉ có một tiến trình duy nhất đại diện cho toàn hệ thống, bốn tác nhân là Khách hàng, Nhân viên bán hàng, Nhân viên kho, Quản trị viên cùng hai tác nhân ngoài là Nhà cung cấp và Cổng thanh toán Stripe. Ở mức này không xuất hiện kho dữ liệu.'),
  ...figP('dfd_context.png', 'Hình 2.2. Sơ đồ ngữ cảnh (DFD mức 0)', 8800),
  H2('2.3. Sơ đồ dòng dữ liệu mức đỉnh'),
  P('Tiến trình duy nhất của sơ đồ ngữ cảnh được phân rã thành sáu tiến trình và sáu kho dữ liệu. Các tác nhân và dòng dữ liệu vào/ra của sơ đồ ngữ cảnh được bảo toàn.'),
  table(['Tiến trình', 'Mô tả'], [
    ['1. Quản lý tài khoản & phân quyền', 'Tạo/sửa/khoá tài khoản, gán quyền cho vai trò, đọc nhật ký'],
    ['2. Quản lý sản phẩm & danh mục', 'Thêm, sửa, xoá sản phẩm, danh mục, thương hiệu, thuộc tính'],
    ['3. Mua hàng trực tuyến', 'Tìm, xem sản phẩm, quản lý giỏ, đặt hàng, thanh toán (COD, chuyển khoản, thẻ Stripe), theo dõi/huỷ đơn, hồ sơ khách'],
    ['4. Xử lý đơn hàng, hoá đơn, bảo hành', 'Duyệt/huỷ đơn, xác nhận thanh toán, lập và in hoá đơn, tra cứu bảo hành'],
    ['5. Quản lý nhập kho', 'Quản lý nhà cung cấp, lập/chốt/huỷ/in phiếu nhập, tra cứu tồn kho và Serial'],
    ['6. Lập báo cáo thống kê', 'Tổng hợp doanh thu, sản phẩm bán chạy từ dữ liệu bán hàng'],
  ], [3300, 5771]),
  new Paragraph({ spacing: { after: 120 }, children: [] }),
  table(['Kho dữ liệu', 'Bảng CSDL tương ứng'], [
    ['D1. Tài khoản & phân quyền', 'Roles, Permissions, RolePermissions, Accounts, Employees, PasswordResets, Sessions'],
    ['D2. Sản phẩm & danh mục', 'Categories, Brands, Products, ProductImages, Attributes, ProductAttributeValues, CompatibilityRules'],
    ['D3. Khách hàng & giỏ hàng', 'Customers, CustomerAddresses, MembershipTiers, Carts, CartItems, ChatConversations, ChatMessages'],
    ['D4. Đơn hàng & hoá đơn', 'Orders, OrderDetails, OrderDetailSerials, Promotions, Invoices, Warranties'],
    ['D5. Nhà cung cấp, phiếu nhập & Serial', 'Suppliers, GoodsReceipts, GoodsReceiptDetails, ProductSerials'],
    ['D6. Nhật ký hệ thống', 'AuditLogs'],
  ], [3300, 5771]),
);
landscape(...figL('dfd_top.png', 'Hình 2.3. Sơ đồ dòng dữ liệu mức đỉnh'));
portrait(
  H2('2.4. Sơ đồ dòng dữ liệu mức dưới đỉnh'),
  P('Ba tiến trình cốt lõi gắn với yêu cầu chấm điểm của đồ án (mua hàng, xử lý đơn hàng, nhập kho) được phân rã tiếp xuống mức dưới đỉnh. Phân rã không thêm tác nhân ngoài mới; các kho dữ liệu D2, D3, D4, D5 được giữ nguyên tên và ký hiệu từ mức đỉnh.'),
  H3('2.4.1. Phân rã tiến trình 3 – Mua hàng trực tuyến'),
  ...figP('dfd_3.png', 'Hình 2.4. DFD mức dưới đỉnh của tiến trình 3', 9000),
  H3('2.4.2. Phân rã tiến trình 4 – Xử lý đơn hàng, hoá đơn, bảo hành'),
  P('Khi duyệt đơn (4.1), hệ thống đọc đơn chờ duyệt, trừ tồn kho ở D2, lấy Serial tồn kho theo nguyên tắc nhập trước xuất trước từ D5, ghi đơn đã duyệt cùng hoá đơn vào D4. Khi huỷ đơn (4.2), luồng ngược lại: hoàn tồn kho, trả Serial, vô hiệu hoá đơn và bảo hành.'),
  ...figP('dfd_4.png', 'Hình 2.5. DFD mức dưới đỉnh của tiến trình 4', 9000),
  H3('2.4.3. Phân rã tiến trình 5 – Quản lý nhập kho'),
  ...figP('dfd_5.png', 'Hình 2.6. DFD mức dưới đỉnh của tiến trình 5', 9000),
  P('Các tiến trình 1, 2 và 6 là các thao tác danh mục/báo cáo đơn giản (thêm – sửa – xoá – tra cứu trên một kho dữ liệu) nên được mô tả trực tiếp ở mức đỉnh.'),
);

// =====================================================================
// CHƯƠNG 3 – THIẾT KẾ CSDL
// =====================================================================
const nTables = dict.tables.length;
portrait(
  H1('CHƯƠNG 3. THIẾT KẾ CƠ SỞ DỮ LIỆU'),
  P(`Lược đồ CSDL (LaptopShopDB) được thiết kế dựa trên sáu kho dữ liệu D1–D6 đã phân tích ở Chương 2, gồm ${nTables} bảng. Mô hình thực thể – kết hợp dưới đây vẽ theo ký hiệu Peter Chen (thực thể là hình chữ nhật, mối kết hợp là hình thoi, thuộc tính là hình oval, khoá chính được gạch chân, thuộc tính đa trị là oval viền đôi, thuộc tính suy diễn là oval nét đứt, bản số ghi dạng (min,max) trên đường nối). Để dễ đọc, mô hình được chia làm bốn hình theo cụm nghiệp vụ; các thực thể xuất hiện ở nhiều hình (KHACHHANG, NHANVIEN, SANPHAM, DONHANG, SERIAL) là cùng một thực thể.`),
  H2('3.1. Mô hình thực thể – kết hợp (ERD)'),
  P('Các bảng trung gian của quan hệ nhiều–nhiều được thể hiện là mối kết hợp có thuộc tính: Có_quyền (RolePermissions), Có_giá_trị (ProductAttributeValues), Chứa (CartItems), Gồm giữa DONHANG và SANPHAM (OrderDetails) và Gồm giữa PHIEUNHAP và SANPHAM (GoodsReceiptDetails).'),
);
landscape(
  ...figL('erd_a.png', 'Hình 3.1. ERD – Người dùng và phân quyền'),
  ...figL('erd_b.png', 'Hình 3.2. ERD – Sản phẩm, nhập kho và Serial'),
  ...figL('erd_c1.png', 'Hình 3.3. ERD – Giỏ hàng và đơn hàng'),
  ...figL('erd_c2.png', 'Hình 3.4. ERD – Hoá đơn, Serial và bảo hành'),
);

// ---- lược đồ quan hệ ----
function schemaPara(t) {
  const runs = [new TextRun({ text: t.name, font: FONT, size: 22, bold: true }), new TextRun({ text: '(', font: FONT, size: 22 })];
  t.cols.forEach((c, i) => {
    const key = c[3];
    const isPk = /PK/.test(key), isFk = /FK/.test(key);
    const ref = (key.match(/FK → (\w+)/) || [])[1];
    runs.push(new TextRun({ text: c[0], font: FONT, size: 22, underline: isPk ? {} : undefined, italics: isFk && !isPk }));
    if (isFk) runs.push(new TextRun({ text: ref ? `#${ref}` : '#', font: FONT, size: 18, superScript: true }));
    if (i < t.cols.length - 1) runs.push(new TextRun({ text: ', ', font: FONT, size: 22 }));
  });
  runs.push(new TextRun({ text: ')', font: FONT, size: 22 }));
  return new Paragraph({ spacing: { after: 90, line: 300 }, alignment: AlignmentType.LEFT, children: runs });
}
portrait(
  H2('3.2. Lược đồ cơ sở dữ liệu quan hệ'),
  P('Lược đồ quan hệ gồm toàn bộ các bảng, chia làm bốn hình theo cụm nghiệp vụ. Mỗi khung là một bảng; khoá chính in đậm và gạch chân (PK), khoá ngoại in nghiêng (FK); đường nối đi từ khoá ngoại (chân chim) đến khoá chính của bảng được tham chiếu (gạch ngang). Bảng nền xám nét đứt là bảng tham chiếu đã mô tả ở hình khác.'),
);
landscape(
  ...figL('schema_a.png', 'Hình 3.5. Lược đồ quan hệ – Người dùng và phân quyền'),
  ...figL('schema_b.png', 'Hình 3.6. Lược đồ quan hệ – Sản phẩm và nhập kho'),
  ...figL('schema_c.png', 'Hình 3.7. Lược đồ quan hệ – Giỏ hàng, đơn hàng, hoá đơn, bảo hành'),
  ...figL('schema_d.png', 'Hình 3.8. Lược đồ quan hệ – Chat tư vấn'),
);

// ---- mô tả bảng (dạng gọn) ----
const dictKids = [];
dict.tables.forEach((t, i) => {
  dictKids.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [run('Bảng ' + t.name.toUpperCase(), { bold: true })] }));
  dictKids.push(table(['Thuộc tính', 'Kiểu dữ liệu', 'Mô tả', 'Ghi chú'],
    t.cols.map((c) => [c[0], c[1].replace(/ \(IDENTITY\)/, ''), c[5].replace(/`/g, ''), c[3].replace(/, UQ/, '')]),
    [2100, 1800, 3571, 1600], { size: 21 }));
  dictKids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 120 },
    children: [run(`Bảng ${i + 3} – Danh sách thuộc tính bảng ${t.name.toUpperCase()}`, { italics: true, size: 24 })] }));
});
portrait(
  H2('3.3. Bảng mô tả các bảng và thuộc tính'),
  ...dictKids,
  H2('3.4. View và Stored Procedure'),
  P('Nghiệp vụ nhiều bước được đặt trong stored procedure chạy trong transaction để bảo đảm toàn vẹn; Node.js chỉ gọi EXEC. Mã lỗi nghiệp vụ dùng THROW 50xxx để giao diện hiển thị thông báo đúng.'),
  table(['Đối tượng', 'Loại', 'Chức năng'], [
    ['sp_PostGoodsReceipt', 'Procedure', 'Chốt phiếu nhập: tăng tồn kho, ghi Serial, cập nhật giá nhập'],
    ['sp_PlaceOrder / sp_PlaceOrderFromCart', 'Procedure', 'Đặt hàng (từ danh sách hoặc từ giỏ): kiểm tra tồn khả dụng, tính tiền, giữ chỗ tồn'],
    ['sp_ApproveOrder', 'Procedure', 'Duyệt đơn: trừ tồn, gán Serial theo FIFO, phát hành hoá đơn và bảo hành'],
    ['sp_CancelOrder', 'Procedure', 'Huỷ đơn: nhả giữ chỗ hoặc hoàn tồn, trả Serial, vô hiệu hoá đơn/bảo hành'],
    ['sp_ConfirmPayment / sp_ConfirmRefund', 'Procedure', 'Nhân viên xác nhận đã thanh toán (không áp dụng cho đơn Stripe) / xác nhận đã hoàn tiền'],
    ['sp_MarkPaidByGateway', 'Procedure', 'Ghi nhận Stripe đã thu tiền (webhook hoặc trang quay về), chạy lặp vẫn an toàn; đơn đã huỷ mà khách vẫn trả tiền chuyển sang chờ hoàn tiền'],
    ['sp_CompleteOrder', 'Procedure', 'Hoàn tất đơn hàng'],
    ['sp_ExpirePendingOrders', 'Procedure', 'Tự huỷ đơn chờ quá hạn để nhả hàng giữ chỗ'],
    ['vw_ProductCatalog', 'View', 'Danh sách sản phẩm cho cửa hàng kèm danh mục, thương hiệu, ảnh, tồn khả dụng'],
    ['vw_LowStock', 'View', 'Sản phẩm sắp hết hàng (tồn khả dụng ≤ ngưỡng cảnh báo)'],
    ['vw_SalesDaily, vw_ProductSales', 'View', 'Doanh thu theo ngày; doanh số và lợi nhuận theo sản phẩm'],
    ['vw_SupplierPayables', 'View', 'Công nợ phải trả nhà cung cấp'],
  ], [3300, 1400, 4371], { size: 21 }),
  P('Ngoài ra, các ràng buộc CHECK trong bảng bảo vệ các bất biến chính, ví dụ: tồn kho không âm và số giữ chỗ không vượt tồn thực; trạng thái đơn, hoá đơn, bảo hành, phiếu nhập chỉ nhận các giá trị hợp lệ.'),
  H2('3.5. Dữ liệu mẫu'),
  P('Tệp database/03_seed.sql tạo sẵn dữ liệu cho tất cả các bảng chính để trình diễn: 4 vai trò kèm danh mục quyền, 13 tài khoản (quản trị, nhân viên bán hàng, nhân viên kho, khách hàng), 89 sản phẩm cùng danh mục, thương hiệu, thuộc tính kỹ thuật và luật tương thích, nhà cung cấp, phiếu nhập kèm Serial, khuyến mãi, hạng thành viên và các đơn hàng ở đủ trạng thái cùng hoá đơn, bảo hành.'),
);

// =====================================================================
// CHƯƠNG 4 – GIAO DIỆN
// =====================================================================
portrait(
  H1('CHƯƠNG 4. THIẾT KẾ GIAO DIỆN VÀ CHỨC NĂNG'),
  P('Giao diện được xây dựng bằng EJS và Bootstrap 5. Mỗi khu vực có bố cục và tông màu riêng (Admin màu xanh đen, Kho màu nâu cam…) để người dùng phân biệt ngay khu vực đang làm việc; cửa hàng dành cho khách có bố cục thương mại điện tử. Các ảnh dưới đây chụp từ bản chạy thật với dữ liệu mẫu.'),
  H2('4.1. Cửa hàng dành cho khách hàng'),
  H3('4.1.1. Trang chủ'),
  P('Trang chủ giới thiệu danh mục, sản phẩm nổi bật, khuyến mãi; thanh tìm kiếm có gợi ý theo từ khoá; khung chat nổi để hỏi nhân viên hoặc trợ lý AI.'),
  ...shot('store_home', 'Hình 4.1. Trang chủ cửa hàng'),
  H3('4.1.2. Danh sách sản phẩm – tìm kiếm, lọc, sắp xếp'),
  P('Khách xem thông tin hàng hoá và số lượng còn hàng, tìm theo tên, lọc theo danh mục, thương hiệu, thuộc tính kỹ thuật và khoảng giá, sắp xếp theo tên hoặc giá, có phân trang.'),
  ...shot('store_products', 'Hình 4.2. Danh sách sản phẩm với bộ lọc và sắp xếp'),
  H3('4.1.3. Chi tiết sản phẩm'),
  P('Trang chi tiết hiển thị ảnh, giá, tình trạng tồn, thông số kỹ thuật, bảo hành, nút thêm vào giỏ và danh sách linh kiện tương thích (RAM, SSD…) nhóm theo danh mục.'),
  ...shot('store_detail', 'Hình 4.3. Chi tiết sản phẩm'),
  H3('4.1.4. Đăng nhập'),
  ...shot('login', 'Hình 4.4. Màn hình đăng nhập'),
  H3('4.1.5. Giỏ hàng và đặt hàng'),
  P('Khách chọn sản phẩm cần mua trong giỏ, điều chỉnh số lượng; hệ thống tạm tính, hiển thị mức miễn phí vận chuyển. Bước thanh toán nhập địa chỉ, chọn phương thức thanh toán, áp mã khuyến mãi rồi đặt hàng; đơn mới ở trạng thái chờ và giữ chỗ tồn kho.'),
  ...shot('cart', 'Hình 4.5. Giỏ hàng'),
  H3('4.1.6. Lịch sử đơn hàng và hồ sơ'),
  ...shot('customer_orders', 'Hình 4.6. Lịch sử đơn hàng của khách'),
  ...shot('customer_account', 'Hình 4.7. Hồ sơ khách hàng và sổ địa chỉ'),

  H2('4.2. Khu vực Quản trị (Admin)'),
  H3('4.2.1. Tổng quan'),
  ...shot('admin_dashboard', 'Hình 4.8. Trang tổng quan của quản trị viên'),
  H3('4.2.2. Quản lý tài khoản'),
  P('Quản trị viên lọc/tìm tài khoản, thêm mới, sửa, khoá/mở khoá, đặt lại mật khẩu và xoá. Tài khoản hệ thống tự động không cho chỉnh sửa.'),
  ...shot('admin_users', 'Hình 4.9. Quản lý tài khoản người dùng'),
  H3('4.2.3. Phân quyền theo vai trò'),
  P('Mỗi vai trò được gán tập quyền chi tiết theo module (ví dụ product.create, order.approve); thay đổi có hiệu lực ngay ở request kế tiếp mà người dùng không cần đăng nhập lại.'),
  ...shot('admin_permissions', 'Hình 4.10. Gán quyền cho vai trò'),
  H3('4.2.4. Nhật ký hoạt động'),
  ...shot('admin_audit', 'Hình 4.11. Nhật ký hoạt động hệ thống'),

  H2('4.3. Khu vực Nhân viên bán hàng'),
  ...shot('staff_dashboard', 'Hình 4.12. Tổng quan bán hàng'),
  ...shot('staff_products', 'Hình 4.13. Quản lý sản phẩm (thêm, sửa, xoá, tìm kiếm)'),
  P('Danh sách đơn hàng cho phép lọc theo trạng thái; trong trang chi tiết đơn, nhân viên duyệt đơn, huỷ đơn (kèm lý do), xác nhận thanh toán, hoàn tất đơn hoặc xác nhận hoàn tiền. Khi duyệt, số lượng trong kho giảm và hoá đơn được phát hành; khi huỷ, số lượng được trả lại kho.'),
  ...shot('staff_orders', 'Hình 4.14. Danh sách đơn hàng'),
  ...shot('staff_order_detail', 'Hình 4.15. Chi tiết đơn hàng và các thao tác duyệt/huỷ'),
  ...shot('staff_invoices', 'Hình 4.16. Danh sách hoá đơn bán hàng (xem, in, lọc theo thời gian)'),
  ...shot('staff_reports', 'Hình 4.17. Thống kê, báo cáo bán hàng'),

  H2('4.4. Khu vực Nhân viên kho'),
  ...shot('wh_dashboard', 'Hình 4.18. Tổng quan kho'),
  ...shot('wh_suppliers', 'Hình 4.19. Quản lý nhà cung cấp'),
  P('Phiếu nhập kho được lập ở trạng thái nháp (có thể sửa hoặc huỷ); khi chốt, tồn kho tăng và Serial của từng máy được ghi nhận. Phiếu nhập có thể in và lưu trữ.'),
  ...shot('wh_receipts', 'Hình 4.20. Danh sách phiếu nhập kho'),
  ...shot('wh_stock', 'Hình 4.21. Tồn kho: tồn thực, giữ chỗ, khả dụng, ngưỡng cảnh báo'),
);

// =====================================================================
// CHƯƠNG 5 – CÀI ĐẶT, SỬ DỤNG
// =====================================================================
portrait(
  H1('CHƯƠNG 5. CÀI ĐẶT VÀ HƯỚNG DẪN SỬ DỤNG'),
  H2('5.1. Phương án cài đặt'),
  P('Hệ thống gồm hai thành phần: máy chủ ứng dụng Node.js và CSDL SQL Server. Có thể chạy cả hai trên một máy (phục vụ trình diễn) hoặc tách riêng khi triển khai thật; trình duyệt của người dùng chỉ cần truy cập địa chỉ của máy chủ ứng dụng.'),
  H3('5.1.1. Yêu cầu'),
  ...bullets(['Node.js phiên bản 18 trở lên.', 'SQL Server 2017 trở lên, bật đăng nhập SQL (Mixed Mode); công cụ SSMS hoặc Azure Data Studio.', 'Trình duyệt hiện đại (Edge, Chrome, Firefox).']),
  H3('5.1.2. Các bước cài đặt'),
  ...numbered('num2', [
    'Mở SSMS/Azure Data Studio, chạy lần lượt ba tệp trong thư mục database trong cùng một cửa sổ kết nối: 01_schema.sql (xoá và tạo lại CSDL LaptopShopDB cùng các bảng), 02_programmability.sql (view, stored procedure), 03_seed.sql (dữ liệu mẫu, tài khoản kiểm thử, tạo lại login laptopshop_app).',
    'Sao chép .env.example thành .env và sửa DB_SERVER, DB_USER, DB_PASSWORD (và SESSION_SECRET) cho đúng máy.',
    'Chạy npm install để cài thư viện.',
    'Chạy npm run db:check để kiểm tra kết nối CSDL (in ra số sản phẩm và tài khoản).',
    'Chạy npm run dev (hoặc npm start) rồi mở http://localhost:3001 (cổng theo biến PORT trong .env).',
    'Tuỳ chọn: điền GOOGLE_CLIENT_ID/SECRET để bật đăng nhập Google, SMTP_* để gửi email thật (nếu bỏ trống, email được lưu thành tệp HTML trong thư mục outbox), GEMINI_API_KEY cho trợ lý AI trong khung chat, STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY/STRIPE_WEBHOOK_SECRET để bật thanh toán thẻ Stripe (chế độ test; chưa điền thì lựa chọn Stripe bị ẩn ở bước thanh toán).',
  ]),
  P('Kiểm thử tự động không cần SQL Server: chạy npm test.'),
  H3('5.1.3. Tài khoản kiểm thử (mật khẩu chung 123456)'),
  table(['Tài khoản', 'Vai trò', 'Địa chỉ làm việc'], [
    ['admin', 'Quản trị viên', '/admin'],
    ['sales1, sales2', 'Nhân viên bán hàng', '/staff'],
    ['kho1', 'Nhân viên kho', '/warehouse'],
    ['khach1, khach2, khach3', 'Khách hàng', '/'],
  ], [3000, 3000, 3071]),
  P('Khi chạy thật cần đặt NODE_ENV=production, SESSION_SECRET ngẫu nhiên và tắt hiển thị tài khoản mẫu (SHOW_DEMO_ACCOUNTS=false); đổi ngay mật khẩu các tài khoản mẫu.'),

  H2('5.2. Hướng dẫn sử dụng'),
  H3('5.2.1. Khách hàng'),
  ...numbered('num3', [
    'Truy cập trang chủ, tìm kiếm hoặc duyệt theo danh mục; dùng bộ lọc giá, thương hiệu, thuộc tính; mở trang chi tiết để xem thông số và linh kiện tương thích.',
    'Bấm “Thêm vào giỏ”; mở Giỏ hàng, chọn các sản phẩm cần mua, chỉnh số lượng rồi bấm “Mua hàng đã chọn”.',
    'Tại trang thanh toán, nhập hoặc chọn địa chỉ giao hàng, chọn phương thức thanh toán, nhập mã khuyến mãi (nếu có) rồi đặt hàng. Hệ thống hiển thị mã đơn.',
    'Theo dõi đơn ở mục Đơn hàng của tôi; bấm Huỷ khi đơn còn ở trạng thái chờ. Khách vãng lai tra cứu đơn tại “Tra cứu đơn hàng” bằng mã đơn.',
  ]),
  H3('5.2.2. Nhân viên bán hàng'),
  ...numbered('num4', [
    'Đăng nhập tài khoản bán hàng; xem tổng quan đơn mới và doanh thu.',
    'Vào Đơn hàng, mở đơn chờ duyệt và bấm Duyệt (kho giảm, hoá đơn và bảo hành được tạo) hoặc Huỷ (nhập lý do; kho được hoàn lại).',
    'Vào Hoá đơn để xem theo khoảng thời gian, bấm In để in hoá đơn; vào Báo cáo xem doanh thu và sản phẩm bán chạy; vào Bảo hành để tra cứu theo Serial hoặc số điện thoại.',
    'Quản lý sản phẩm, danh mục, thương hiệu, thuộc tính ở mục Sản phẩm; trả lời khách ở mục Chat.',
  ]),
  H3('5.2.3. Nhân viên kho'),
  ...numbered('num5', [
    'Đăng nhập tài khoản kho; xem tồn kho, lọc theo nhóm hàng hoặc mức tồn.',
    'Vào Nhà cung cấp để thêm/sửa/xoá nhà cung cấp; vào Phiếu nhập kho chọn “Lập phiếu”, chọn nhà cung cấp, thêm sản phẩm với số lượng, đơn giá và số Serial rồi lưu nháp.',
    'Mở phiếu và bấm Chốt để tăng tồn kho (hoặc Huỷ nếu nhập sai); bấm In để in và lưu phiếu nhập; xem Sổ kho để thống kê lịch sử nhập theo thời gian.',
  ]),
  H3('5.2.4. Quản trị viên'),
  ...numbered('num6', [
    'Đăng nhập tài khoản quản trị; vào Tài khoản để thêm, sửa, khoá hoặc đặt lại mật khẩu người dùng.',
    'Vào Vai trò & phân quyền, chọn vai trò và đánh dấu các quyền được phép; vào Nhật ký để truy vết thao tác.',
  ]),
  H2('5.3. Kịch bản trình diễn gợi ý'),
  ...numbered('num7', [
    'Đăng nhập khach1, thêm laptop vào giỏ, đặt hàng thanh toán khi nhận hàng → đơn ở trạng thái chờ, “giữ chỗ” của sản phẩm tăng.',
    'Đăng nhập sales1, duyệt đơn vừa tạo → “Tồn thực” giảm, “giữ chỗ” giảm, hoá đơn và bảo hành được tạo; in hoá đơn.',
    'Huỷ đơn đã duyệt → tồn thực tăng lại, Serial được trả, hoá đơn và bảo hành bị vô hiệu.',
    'Đăng nhập kho1, lập phiếu nhập cho một sản phẩm rồi chốt → tồn kho tăng, Serial mới xuất hiện ở Tra cứu Serial.',
    'Đăng nhập admin, thu hồi một quyền của vai trò bán hàng → tài khoản bán hàng mất quyền đó ngay ở request kế tiếp; xem bản ghi trong nhật ký.',
  ]),
);

// =====================================================================
// CHƯƠNG 6 – TỔNG KẾT
// =====================================================================
portrait(
  H1('CHƯƠNG 6. TỔNG KẾT'),
  H2('6.1. Kết quả đạt được'),
  ...bullets([
    'Hoàn thành hệ thống bán hàng laptop & linh kiện với bốn khu vực tách biệt (Cửa hàng, Bán hàng, Kho, Admin), phủ đủ các yêu cầu của cả hai hướng nghiệp vụ Mua hàng và Nhập xuất kho.',
    'Xây dựng đầy đủ bộ tài liệu phân tích: BFD, sơ đồ ngữ cảnh, DFD mức đỉnh và dưới đỉnh, ERD Peter Chen, lược đồ quan hệ và từ điển dữ liệu.',
    'Quy trình tồn kho chính xác theo từng Serial, nghiệp vụ trọng yếu nằm trong stored procedure có transaction; có dữ liệu mẫu và tài khoản kiểm thử để trình diễn.',
  ]),
  H2('6.2. Ưu điểm'),
  ...bullets([
    'Toàn vẹn dữ liệu cao: ràng buộc CHECK, khoá ngoại, transaction và kiểm soát đồng thời khi đặt/duyệt/huỷ đơn và nhập kho.',
    'Phân quyền chi tiết theo vai trò, hiệu lực ngay lập tức; ghi nhật ký mọi thao tác quan trọng.',
    'Bảo mật nhiều lớp: băm mật khẩu, CSP, chống CSRF theo Origin, giới hạn tần suất, phiên lưu trong CSDL.',
    'Có kiểm thử tự động và quy trình làm việc nhóm theo module, dễ mở rộng.',
    'Mô hình thuộc tính kỹ thuật linh hoạt (EAV) cho phép thêm loại sản phẩm mới mà không đổi cấu trúc bảng; gợi ý linh kiện tương thích theo luật.',
  ]),
  H2('6.3. Hạn chế'),
  ...bullets([
    'Thanh toán thẻ qua Stripe mới chạy ở chế độ thử nghiệm (test mode); chuyển khoản vẫn do nhân viên xác nhận thủ công; chưa tích hợp đơn vị vận chuyển.',
    'Số liệu tồn kho gộp trực tiếp trong bảng Products, chưa có bảng sổ kho chi tiết từng lần xuất/nhập nên báo cáo biến động tồn theo thời điểm còn hạn chế.',
    'Truy vấn lọc theo thuộc tính kỹ thuật (EAV) có thể chậm khi số lượng sản phẩm lớn nếu không bổ sung chỉ mục/tối ưu thêm.',
    'Chưa có ứng dụng di động; chat dựa trên thăm dò định kỳ thay vì kết nối thời gian thực.',
  ]),
  H2('6.4. Hướng phát triển'),
  ...bullets([
    'Chuyển Stripe sang chế độ chạy thật, bổ sung các cổng thanh toán nội địa (VNPay, MoMo…) và dịch vụ giao hàng; theo dõi vận đơn.',
    'Bổ sung sổ kho chi tiết, kiểm kê, chuyển kho nhiều kho/chi nhánh, đặt hàng nhà cung cấp.',
    'Mở rộng báo cáo (lãi lỗ theo kỳ, công nợ nhà cung cấp, dự báo tồn), xuất Excel/PDF.',
    'Chat thời gian thực bằng WebSocket, thông báo đẩy, ứng dụng di động.',
    'Triển khai container hoá, sao lưu CSDL tự động và giám sát vận hành.',
  ]),
  H2('6.5. Đối chiếu với bảng yêu cầu đồ án'),
  table(['Yêu cầu', 'Đáp ứng'], [
    ['Giới thiệu HTTT, mục tiêu, dữ liệu vào/ra, xử lý', 'Chương 1'],
    ['Sơ đồ chức năng, ngữ cảnh, DFD mức đỉnh và dưới đỉnh', 'Chương 2 (Hình 2.1–2.6)'],
    ['Thiết kế CSDL: lược đồ từ các kho dữ liệu, bảng mô tả bảng và thuộc tính', 'Chương 3'],
    ['Thiết kế giao diện: hình ảnh và giới thiệu chức năng', 'Chương 4'],
    ['Phương án cài đặt, hướng dẫn sử dụng, ưu nhược điểm, hướng phát triển', 'Chương 5, 6'],
    ['CSDL đầy đủ bảng và dữ liệu thử; script SQL', 'database/01_schema.sql, 02_programmability.sql, 03_seed.sql'],
    ['Giao diện Admin tách biệt; quản lý user và phân quyền', 'Mục 4.2, khu vực /admin'],
    ['Người mua: xem hàng, tìm kiếm, lọc theo giá và tên, mua hàng', 'Mục 4.1'],
    ['Nhân viên bán hàng: duyệt, huỷ đơn (kho giảm/hoàn), in/lưu/xem hoá đơn theo thời điểm, thống kê, CRUD sản phẩm', 'Mục 4.3'],
    ['Nhân viên kho: xem/tìm/lọc hàng, lập phiếu nhập (kho tăng)', 'Mục 4.4'],
    ['Quản lý kho: CRUD sản phẩm và nhà cung cấp, in/lưu phiếu nhập, thống kê nhập kho theo thời gian', 'Mục 4.3, 4.4'],
    ['Tệp nộp: readme, mã nguồn, báo cáo, script SQL', 'README.md, thư mục src, báo cáo này, thư mục database'],
  ], [5600, 3471], { size: 21 }),
);

// =====================================================================
// LẮP RÁP
// =====================================================================
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] });
const doc = new Document({
  creator: 'Nhóm đồ án PTTK HTTT', title: 'Báo cáo đồ án PTTK HTTT – Hệ thống quản lý bán hàng laptop',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 26 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: FONT }, paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: FONT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ...['num1', 'num2', 'num3', 'num4', 'num5', 'num6', 'num7'].map((r) => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
    ],
  },
  sections: sections.map((s) => ({
    properties: {
      page: {
        size: { width: 11906, height: 16838, orientation: s.orient === 'l' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: s.orient === 'l' ? { top: 1134, bottom: 1134, left: 1134, right: 1134 } : { top: MT, bottom: MB, left: ML, right: MR },
      },
    },
    footers: { default: footer },
    children: s.kids,
  })),
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log('wrote', OUT, b.length); });
