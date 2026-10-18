---
name: pttk-diagram-notation
description: Quy ước ký hiệu vẽ sơ đồ ERD, BFD, DFD theo đúng chuẩn môn "Phân tích thiết kế hệ thống thông tin" (dựa trên slide bài giảng gốc của môn). Load skill này trước khi vẽ/tạo bất kỳ sơ đồ ERD, DFD, BFD nào cho đồ án/báo cáo của môn học này — KHÔNG được vẽ theo kiểu UML class diagram hay kiểu khác.
---

# Quy ước vẽ sơ đồ - Phân tích thiết kế HTTT

Đây là tài liệu quy ước **bắt buộc tuân theo** khi vẽ các sơ đồ cho đồ án môn Phân tích thiết kế hệ thống thông tin (dựa đúng theo slide giảng dạy: mô hình thực thể kết hợp Peter Chen, và DFD/BFD theo DeMarco & Yourdon / Gane & Sarson).

**Quan trọng nhất:** ERD ở đây là mô hình **Thực thể - Kết hợp (Entity - Relationship / Peter Chen)**, KHÔNG PHẢI UML Class Diagram. Không được vẽ entity dạng class box có 3 ngăn (tên lớp / thuộc tính / phương thức), không dùng ký hiệu quan hệ kiểu UML (mũi tên rỗng kế thừa, kim cương composition/aggregation của UML...).

## 1. ERD — Mô hình Thực thể - Kết hợp (Entity-Relationship, Peter Chen)

| Thành phần | Ký hiệu | Ghi chú |
|---|---|---|
| **Thực thể (Entity)** | Hình **chữ nhật** | Tên là danh từ/cụm danh từ, viết trong hình chữ nhật. VD: `NHANVIEN`, `PHONGBAN` |
| **Thuộc tính (Attribute)** | Hình **oval/ellipse**, nối vào thực thể hoặc mối kết hợp bằng 1 đường thẳng | Tên là danh từ. Thuộc tính khóa: gạch chân (underline) tên thuộc tính trong oval |
| **Thuộc tính đa trị (multivalued)** | Oval có **viền đôi** (double ellipse) | VD: Số điện thoại, Địa chỉ |
| **Thuộc tính suy diễn (derived)** | Oval có **viền nét đứt** (dashed ellipse) | VD: Tuổi (suy ra từ ngày sinh) |
| **Thuộc tính kết hợp (composite)** | Oval cha nối tới các oval con nhỏ hơn | VD: Họ tên → Họ, Chữ lót, Tên |
| **Mối kết hợp / quan hệ (Relationship)** | Hình **thoi/diamond** | Tên là động từ/cụm động từ, nối giữa 2 (hoặc nhiều) thực thể. VD: `Làm_việc`, `Thuộc`, `Phụ_trách` |
| **Bản số (cardinality / min,max)** | Ghi số **(min, max)** trên đường nối giữa thực thể và mối kết hợp | (0,1) không hoặc một; (1,1) duy nhất một; (0,n) không hoặc nhiều; (1,n) một hoặc nhiều |

**Quy tắc đặt tên:**
- Tên thực thể = danh từ/cụm danh từ (NHANVIEN, PHONGBAN, DEAN)
- Tên mối kết hợp = động từ/cụm động từ (Làm_việc, Thuộc, Phụ_trách, Hưởng)
- Tên thuộc tính = danh từ/cụm danh từ, thuộc tính khóa được **gạch chân**

**KHÔNG được:**
- Vẽ entity dạng box 3 ngăn như class trong UML
- Dùng mũi tên có đầu rỗng/đặc kiểu kế thừa, aggregation, composition của UML
- Bỏ qua hình thoi cho mối kết hợp (không được nối thẳng 2 thực thể bằng 1 đường có nhãn mà không qua hình thoi)
- Gộp thuộc tính vào bên trong hình chữ nhật thực thể (thuộc tính luôn là oval riêng, nối ra ngoài)

Ví dụ chuẩn (từ slide gốc): thực thể `NHANVIEN` (hình chữ nhật) nối với thực thể `PHONGBAN` (hình chữ nhật) qua mối kết hợp `Làm_việc` (hình thoi), có các thuộc tính oval gắn vào từng thực thể, bản số ghi (1,1)/(1,n) trên các đường nối. Ví dụ khác: `MATHANG` –(1,1)– `THUỘC` –(0,n)– `NHASANXUAT`.

**Dễ nhầm lẫn — các mô hình KHÁC không phải ERD, đừng lấy ký hiệu của chúng gắn vào ERD:**
- **UML Class/Object/Sequence diagram** (lớp = hình chữ nhật 3 ngăn, kết hợp = đường có kim cương rỗng/đặc kiểu UML, message = mũi tên có nhãn trong sequence diagram) — đây là mô hình hướng đối tượng (OOA), chỉ dùng nếu đồ án yêu cầu rõ ràng là UML, không trộn vào ERD Chen.
- **Mô hình tổ chức/luân chuyển (swimlane / organization chart)** — dùng các cột phân chia theo bộ phận (vd "Khách hàng | Bộ phận bán hàng | Kho | Văn phòng"), bên trong mỗi cột là các bước xử lý nối tiếp nhau bằng mũi tên và các tài liệu giấy tờ (hình chữ nhật có góc bo như tờ giấy) hoặc kho CSDL (hình trụ). Đây **không phải DFD** dù nhìn tương tự — nó mô tả luồng công việc vật lý qua các phòng ban, không theo ký hiệu tiến trình/kho dữ liệu/đầu cuối chuẩn của DFD.
- **Mô hình động (Petri-net / mô hình trạng thái)** — trạng thái = hình tròn/oval bo tròn, biến cố = mũi tên có nhãn, trạng thái khởi tạo = chấm tròn đặc, trạng thái kết thúc = chấm tròn đặc có viền tròn bao quanh. Dùng để mô tả vòng đời đối tượng (vd trạng thái đơn hàng), không phải ERD/DFD.
- **Mô hình xử lý Merise** — biến cố = oval, đồng bộ = hình ngũ giác/mũi tên dẹt có chia "Được/Không", hành động = hình chữ nhật 2 ngăn. Khác hẳn ký hiệu DFD.

Nếu đồ án yêu cầu "ERD" hoặc "DFD" cụ thể, chỉ dùng đúng bộ ký hiệu tương ứng ở mục 1 và 3, không mượn ký hiệu từ các mô hình trên.

## 2. BFD — Business Function Diagram (Mô hình phân rã chức năng)

- Mỗi **chức năng** là 1 hình **chữ nhật**, tên là mệnh đề động từ (động từ + bổ ngữ).
- Quan hệ phân cấp (bao hàm) giữa chức năng cha và chức năng con vẽ bằng đường thẳng nối từ trên xuống, dạng cây phân cấp (giống sơ đồ tổ chức/cây thư mục), KHÔNG dùng mũi tên.
- Không có luồng dữ liệu, không có kho dữ liệu, không có tác nhân trong BFD — BFD chỉ thuần là cây chức năng tĩnh.

## 3. DFD — Data Flow Diagram (Mô hình dòng dữ liệu)

Dùng ký hiệu theo một trong hai chuẩn (chọn 1 và dùng nhất quán xuyên suốt đồ án — khuyến nghị theo đúng slide là **DeMarco & Yourdon**):

| Thành phần | DeMarco & Yourdon | Gane & Sarson |
|---|---|---|
| **Tiến trình (Process)** | Hình **tròn** (circle), có số thứ tự phía trên, tên xử lý phía dưới, tên = động từ + bổ ngữ | Hình chữ nhật bo góc |
| **Dòng dữ liệu (Data Flow)** | Mũi tên có nhãn (tên = cụm danh từ) | Mũi tên có nhãn |
| **Kho dữ liệu (Data Store)** | Hai đường thẳng song song (open-ended rectangle), tên ở giữa | Hình chữ nhật có 1 cạnh trái đậm |
| **Đầu cuối/Tác nhân (Terminal)** | Hình **chữ nhật** | Hình chữ nhật |

**Quy tắc đặt tên:**
- Tên tiến trình = động từ (do) + bổ ngữ (what). VD: "Lập hóa đơn", "Tính tồn kho". KHÔNG đặt tên tiến trình là danh từ (VD sai: "Tồn vật tư").
- Tên dòng dữ liệu = cụm danh từ (nội dung dữ liệu di chuyển)
- Tên kho dữ liệu = danh từ/cụm danh từ
- Tên đầu cuối = danh từ/cụm danh từ

**Các mức DFD:**
1. **Sơ đồ ngữ cảnh (Context Diagram)**: chỉ có 1 tiến trình duy nhất đại diện toàn hệ thống, các tác nhân ngoài, và luồng dữ liệu vào/ra. KHÔNG có kho dữ liệu ở mức này.
2. **Sơ đồ mức đỉnh**: phân rã tiến trình duy nhất thành các tiến trình con, bảo toàn tác nhân và luồng dữ liệu, có thể xuất hiện kho dữ liệu.
3. **Sơ đồ mức dưới đỉnh**: tiếp tục phân rã các tiến trình, không thêm tác nhân ngoài mới.

**Quy tắc kết nối hợp lệ (tránh lỗi thường gặp):**
- Hai đầu cuối (terminal) KHÔNG được nối trực tiếp với nhau — phải qua một tiến trình.
- Hai kho dữ liệu KHÔNG được nối trực tiếp với nhau — phải qua một tiến trình.
- Đầu cuối và kho dữ liệu KHÔNG được nối trực tiếp với nhau — phải qua một tiến trình.
- Một tiến trình không được chỉ có đầu ra mà không có đầu vào, và ngược lại.
- Nếu trong một tiến trình không có thông tin mới nào được sinh ra (chỉ chuyển tiếp y nguyên), xem lại vì có thể chưa phải là tiến trình hợp lệ.
- Dòng dữ liệu đi **vào** kho dữ liệu = cập nhật; dòng dữ liệu đi **ra** khỏi kho = khai thác/đọc dữ liệu.

## Khi tạo hình vẽ (vd xuất ra ảnh/SVG/Mermaid/draw.io...)

Khi AI Agent được yêu cầu vẽ ERD/BFD/DFD cho project này:
1. Luôn xác nhận đây là ERD kiểu Chen (entity=chữ nhật, relationship=hình thoi, attribute=oval) chứ không phải class diagram UML.
2. Với DFD, luôn dùng tiến trình=hình tròn (hoặc chữ nhật bo góc nếu theo Gane&Sarson), kho dữ liệu=2 đường thẳng song song hoặc rectangle có cạnh đậm, đầu cuối=hình chữ nhật.
3. Nếu công cụ vẽ (mermaid, plantuml...) không hỗ trợ sẵn hình thoi cho relationship hoặc oval cho attribute, cần tìm cách giả lập đúng hình dạng (vd dùng draw.io/graphviz với shape=diamond, shape=ellipse) thay vì đổi sang ký hiệu khác.
