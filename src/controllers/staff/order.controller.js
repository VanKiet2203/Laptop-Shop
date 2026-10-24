// MODULE 4 - NV BÁN HÀNG: ĐƠN, HOÁ ĐƠN, BÁO CÁO
// Chủ sở hữu: Thành viên 4 - Đơn hàng, hoá đơn, báo cáo
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).

const Order = require('../../models/order.model');

const getAccountId = (req) => req.session?.user?.accountId;

const getOrderId = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getErrorMessage = (err) => {
  const messages = {
    50030: 'Không thể duyệt đơn hàng ở trạng thái hiện tại.',
    50031: 'Đơn hàng chưa đủ điều kiện duyệt.',
    50032: 'Không đủ tồn kho hoặc không thể gán serial.',
    50035: 'Không thể hủy đơn hàng ở trạng thái hiện tại.',
    50036: 'Bạn không có quyền hủy đơn hàng này.',
    50050: 'Đơn hàng chưa đủ điều kiện xác nhận hoàn tiền.',
    50053: 'Không thể xác nhận thanh toán đơn hàng.',
    50055: 'Đơn hàng chưa đủ điều kiện xác nhận thanh toán.',
    50060: 'Không thể hoàn tất đơn hàng ở trạng thái hiện tại.',
    50061: 'Đơn trả trước cần được xác nhận thanh toán trước.'
  };

  return messages[err?.number] ||
    'Thao tác chưa thành công. Vui lòng kiểm tra trạng thái đơn hàng.';
};

// GET /staff/orders
exports.index = async (req, res, next) => {
  try {
    const result = await Order.search({
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
      page: req.query.page,
      pageSize: 10
    });

    return res.render('staff/orders/index', {
      title: 'Quản lý đơn hàng',
      orders: result.rows,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
      filters: {
        status: req.query.status || '',
        from: req.query.from || '',
        to: req.query.to || '',
        q: req.query.q || ''
      },
      message: req.query.message || '',
      error: req.query.error || ''
    });
  } catch (err) {
    next(err);
  }
};

// GET /staff/orders/:id
exports.show = async (req, res, next) => {
  try {
    const orderId = getOrderId(req);

    if (!orderId) {
      return res.status(400).send('Mã đơn hàng không hợp lệ.');
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Không tìm thấy đơn hàng.');
    }

    return res.render('staff/orders/form', {
      title: `Chi tiết đơn hàng ${order.OrderNo}`,
      order,
      message: req.query.message || '',
      error: req.query.error || ''
    });
  } catch (err) {
    next(err);
  }
};

// POST /staff/orders/:id/approve
exports.approve = async (req, res) => {
  const orderId = getOrderId(req);
  const accountId = getAccountId(req);

  if (!orderId || !accountId) {
    return res.status(400).send('Mã đơn hàng hoặc tài khoản không hợp lệ.');
  }

  try {
    await Order.approve(orderId, accountId);
    return res.redirect(
      `/staff/orders/${orderId}?message=${encodeURIComponent('Duyệt đơn thành công.')}`
    );
  } catch (err) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent(getErrorMessage(err))}`
    );
  }
};

// POST /staff/orders/:id/cancel
exports.cancel = async (req, res) => {
  const orderId = getOrderId(req);
  const accountId = getAccountId(req);
  const reason = String(req.body?.reason || '').trim();

  if (!orderId || !accountId) {
    return res.status(400).send('Mã đơn hàng hoặc tài khoản không hợp lệ.');
  }

  if (!reason) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent('Vui lòng nhập lý do hủy đơn.')}`
    );
  }

  try {
    await Order.cancel(orderId, reason, accountId);
    return res.redirect(
      `/staff/orders/${orderId}?message=${encodeURIComponent('Hủy đơn thành công.')}`
    );
  } catch (err) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent(getErrorMessage(err))}`
    );
  }
};

// POST /staff/orders/:id/confirm-payment
exports.confirmPayment = async (req, res) => {
  const orderId = getOrderId(req);
  const accountId = getAccountId(req);

  if (!orderId || !accountId) {
    return res.status(400).send('Mã đơn hàng hoặc tài khoản không hợp lệ.');
  }

  try {
    await Order.confirmPayment(orderId, accountId);
    return res.redirect(
      `/staff/orders/${orderId}?message=${encodeURIComponent('Xác nhận thanh toán thành công.')}`
    );
  } catch (err) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent(getErrorMessage(err))}`
    );
  }
};

// POST /staff/orders/:id/complete
exports.complete = async (req, res) => {
  const orderId = getOrderId(req);
  const accountId = getAccountId(req);

  if (!orderId || !accountId) {
    return res.status(400).send('Mã đơn hàng hoặc tài khoản không hợp lệ.');
  }

  try {
    await Order.complete(orderId, accountId);
    return res.redirect(
      `/staff/orders/${orderId}?message=${encodeURIComponent('Hoàn tất đơn hàng thành công.')}`
    );
  } catch (err) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent(getErrorMessage(err))}`
    );
  }
};

// POST /staff/orders/:id/confirm-refund
exports.confirmRefund = async (req, res) => {
  const orderId = getOrderId(req);
  const accountId = getAccountId(req);

  if (!orderId || !accountId) {
    return res.status(400).send('Mã đơn hàng hoặc tài khoản không hợp lệ.');
  }

  try {
    await Order.confirmRefund(orderId, accountId);
    return res.redirect(
      `/staff/orders/${orderId}?message=${encodeURIComponent('Xác nhận hoàn tiền thành công.')}`
    );
  } catch (err) {
    return res.redirect(
      `/staff/orders/${orderId}?error=${encodeURIComponent(getErrorMessage(err))}`
    );
  }
};
