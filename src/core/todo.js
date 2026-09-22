// Trang "Chưa triển khai": mỗi route khung dựng sẵn hiển thị việc cần làm cho thành viên phụ trách.
// Khi code xong một chức năng, thay lời gọi todo(...) bằng res.render(...) thật.
function todo(res, info) {
  res.status(200).render('partials/todo', { title: info.title || 'Chưa triển khai', info });
}
module.exports = { todo };
