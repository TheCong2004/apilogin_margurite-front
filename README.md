# Hướng dẫn cài đặt và chạy ứng dụng đăng nhập Google với Node.js

## 1. Cài đặt các package cần thiết

Chạy lệnh sau trong thư mục dự án:

```
npm init -y
npm install express express-session passport passport-google-oauth20
```

## 2. Đăng ký ứng dụng Google
- Truy cập https://console.developers.google.com/
- Tạo OAuth 2.0 Client ID
- Lấy Client ID và Client Secret, thay vào file app.js:
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
- Đặt callback URL là: `http://localhost:3000/auth/google/callback`

## 3. Chạy ứng dụng

```
node app.js
```

Truy cập http://localhost:3000 và nhấn "Login with Google" để thử nghiệm.

## 4. Đăng xuất

Truy cập http://localhost:3000/logout để đăng xuất.

---
Nếu gặp lỗi hoặc cần hỗ trợ thêm, hãy liên hệ lại!
# apilogin_margurite-front
