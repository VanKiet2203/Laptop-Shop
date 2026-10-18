// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const CustomerOrder  = require('../../models/customerOrder.model');

// GET /orders
exports.index = async (req, res) => {
  //lấy customerId từ session (đã login) và status từ query string (nếu có)
  const customerId = req.session.user.customerId;
  if (!customerId) {
    return res.status(401).send('Chưa đăng nhập hoặc không phải khách hàng');
  }
  const status = req.query.status || null; // trạng thái chọn , nếu không có thì lấy tất cả

  // gọi model để lấy danh sách Orders của khách hàng, lọc theo trạng thái (nếu có)
  const orders = await CustomerOrder.listByCustomer(customerId, status);
  // trả về view hiển thị danh sách Orders
  res.render('customer/orders', { title: 'Danh sách Orders của khách, lọc theo trạng thái"', orders, status });
 
};

// GET /orders/:id
exports.show = async (req, res) => {
  const customerId = req.session.user.customerId;
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(404).send('Không tìm thấy đơn hàng hoặc hoặc bạn không có quyền xem');
  }

  // gọi model để lấy thông tin chi tiết của đơn hàng
  const orderDetails = await CustomerOrder.findOwned(orderId,customerId);

  // kiểm tra xem đơn hàng có thuộc về khách hàng hiện tại không
  if (!orderDetails) {
    return res.status(403).send('Không tìm thấy đơn hàng hoặc hoặc bạn không có quyền xem');
  }
  res.render('customer/orderDetails', { title: 'Khách - Chi tiết đơn', orderDetails });

};

// POST /orders/:id/cancel
exports.cancel = async (req, res) => {
  // lấy id đơn hàng đang chọn và phải là pedding
  const orderId = parseInt(req.params.id,10);
  const accountId = req.session.user.accountId;
  const reason = req.body.reason || 'Khách hàng huỷ đơn';
  const customerId = req.session.user.customerId;
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(404).send('Không tìm thấy đơn hàng.');
  }
  // kiểm tra xem đơn hàng có thuộc về khách hàng hiện tại không và đang ở trạng thái Pending
  try{
      await CustomerOrder.cancelPending(orderId, accountId, reason);
      req.flash('success', 'Huỷ đơn hàng thành công.');
      return res.redirect('/orders');
  } catch (error) {
    if (error.number === 50064) {
      req.flash('danger', error.message);
      return res.redirect('/orders');
    } else {
      console.error(error);
      throw error; 
    }
  }
  
};
  