// MODULE 3 - KHÁCH MUA HÀNG
// Chủ sở hữu: Thành viên 3 - Khách mua hàng
// Khi làm xong một chức năng: thay todo(...) bằng res.render('<thư mục view>/<tên>', {...}) hoặc res.redirect(...).
const Customer  = require('../../models/customer.model');

// GET /account
exports.profile = async (req, res) =>{ 
    try {
      const customer = await Customer.findById(req.session.user.customerId) || await Customer.findByAccountId(req.session.user.accountId);
      if (!customer) {
        return res.status(404).send('Không tìm thấy thông tin khách hàng');
      }
      res.render('customer/profile', { title: 'Hồ sơ khách hàng', customer }); 
    }
    catch (error) {
      console.error(error);
      res.status(500).send('Không kết nối được cơ sở dữ liệu');
    }
  };




// POST /account
exports.updateProfile = async (req, res) => {
  // kiểm tra dữ liệu đầu vào (nameCustomer, email, phone, TierId) hợp lệ
      const nameCustomer = (req.body.nameCustomer||'').trim();
      const phone = (req.body.phone||'').trim();
      const email = (req.body.email||'').trim();
      
      const erorMessages = [];
      if (!nameCustomer || !email || !phone ) {
        req.flash('error', 'Thiếu thông tin bắt buộc');
        return res.redirect('/account');
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        erorMessages.push('Email không hợp lệ');
      }
      if( !/^\d{10,11}$/.test(phone)) {
        erorMessages.push('Số điện thoại không hợp lệ');
      }
      if (erorMessages.length > 0) {
        req.flash('error', erorMessages.join(', '));
        return res.redirect('/account');
      }
      const customer = await Customer.findById(req.session.user.customerId) || await Customer.findByAccountId(req.session.user.accountId);
      if (!customer) {
        req.flash('error', 'Không tìm thấy thông tin khách hàng');
        return res.redirect('/account');
      }

      // kiểm tra số điện thoại không bị trùng với khách hàng khác (UQ_Customers_Phone)
      const phoneOwner = await Customer.findCustomerByPhone(phone);
      if (phoneOwner && phoneOwner.CustomerId !== customer.CustomerId) {
        req.flash('error', 'Số điện thoại đã được sử dụng bởi tài khoản khác.');
        return res.redirect('/account');
      }

      await Customer.update(customer.CustomerId, { FullName: nameCustomer, Email: email, Phone: phone });
      
      // thông báo cập nhật thành công và chuyển hướng về trang hồ sơ
      req.flash('success', 'Cập nhật hồ sơ thành công.');
      return res.redirect('/account');
      
    };



// GET /account/addresses
exports.addresses = async (req, res) => {
  const addressesCustomer = await Customer.findAddressesByCustomerId(req.session.user.customerId);
  res.render('customer/addresses', { title: 'Địa chỉ giao hàng', addresses: addressesCustomer });
};
  
// POST /account/addresses
exports.addAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    req.flash('error', 'Không tìm thấy thông tin khách hàng trên hệ thống');
    return res.redirect('/account/addresses');
  }
  const ReceiverName = customer.FullName;
  const ReceiverPhone = customer.Phone;
  const addressLine = (req.body.addressLine || '').trim();
  const ward = (req.body.ward || '').trim();
  const district = (req.body.district || '').trim();
  const province = (req.body.province || '').trim();
  const isDefault = req.body.isDefault === '1';
  if(!addressLine || !ward || !district || !province){
    req.flash('error', 'Thiếu thông tin bắt buộc');
    return res.redirect('/account/addresses');
  }
  if(await Customer.addAddress( customer.CustomerId, {
    receiverName: customer.FullName,
    receiverPhone: customer.Phone,
    addressLine: addressLine,
    ward: ward, district: district,
    province: province,
    isDefault: isDefault })){
    req.flash('success', 'Thêm địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    req.flash('error', 'Có lỗi xảy ra khi thêm địa chỉ');
    return res.redirect('/account/addresses');
  }

};

//POST /account/addresses/updateAddress
exports.updateAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    req.flash('error', 'Không tìm thấy thông tin khách hàng trên hệ thống');
    return res.redirect('/account/addresses');
  }
  const ReceiverName = customer.FullName;
  const ReceiverPhone = customer.Phone;
  const addressId = req.body.addressId; // lấy địa chỉ đang muốn cập nhật từ form
  const addressLine = (req.body.addressLine || '').trim();
  const ward = (req.body.ward || '').trim();
  const district = (req.body.district || '').trim();
  const province = (req.body.province || '').trim();
  const isDefault = req.body.isDefault === '1';
  if(!addressId || !addressLine || !ward || !district || !province){
    req.flash('error', 'Thiếu thông tin bắt buộc');
    return res.redirect('/account/addresses');
  }
  if(await Customer.updateAddress(customer.CustomerId, addressId, {
      receiverName: customer.FullName,
      receiverPhone: customer.Phone,
      addressLine: addressLine,
      ward: ward,
      district: district,
      province: province,
      isDefault: isDefault })){
    req.flash('success', 'Cập nhật địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    req.flash('error', 'Có lỗi xảy ra khi cập nhật địa chỉ');
    return res.redirect('/account/addresses');
  }
};

// POST /account/addresses/:id/delete
exports.deleteAddress = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    req.flash('error', 'Không tìm thấy thông tin khách hàng trên hệ thống');
    return res.redirect('/account/addresses');
  }
  const addressId = req.params.id;
  if (!addressId) {
    req.flash('error', 'Thiếu thông tin địa chỉ cần xoá');
    return res.redirect('/account/addresses');
  }

  if(await Customer.deleteAddress(customer.CustomerId, addressId)) {
    req.flash('success', 'Xoá địa chỉ thành công.');
    return res.redirect('/account/addresses');
  } else {
    req.flash('error', 'Có lỗi xảy ra khi xoá địa chỉ');
    return res.redirect('/account/addresses');
  }

};

// POST /account/addresses/:id/default
exports.setDefault = async (req, res) => {
  const customer = await Customer.findById(req.session.user.customerId)|| await Customer.findByAccountId(req.session.user.accountId);
  if (!customer) {
    req.flash('error', 'Không tìm thấy thông tin khách hàng trên hệ thống');
    return res.redirect('/account/addresses');
  }
  const addressId = parseInt(req.params.id,10); // id đang muốn đặt làm mặc định
  if (!addressId) {
    req.flash('error', 'Thiếu thông tin địa chỉ cần đặt mặc định');
    return res.redirect('/account/addresses');
  }
  // nếu đã có thì setdefault, nếu chưa có thì báo lỗi
  if(await Customer.setDefault(customer.CustomerId, addressId)) {
    req.flash('success', 'Đặt địa chỉ mặc định thành công.');
    return res.redirect('/account/addresses');
  } else {
    req.flash('error', 'Có lỗi xảy ra khi đặt địa chỉ mặc định');
    return res.redirect('/account/addresses');
  }
};

