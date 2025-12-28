require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const cors = require('cors'); // <--- Thêm CORS
const jwt = require('jsonwebtoken'); // <--- Thêm JWT để tạo token cho frontend
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// --- CẤU HÌNH CORS ---
// Cho phép Frontend (port 3000) gọi API
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- KẾT NỐI MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    avatar: String,
    role: { type: String, default: 'user' } // Thêm role để phân quyền
});
const User = mongoose.model('User', userSchema);

// --- CẤU HÌNH PASSPORT ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:8000/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                role: 'user'
            });
        }
        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

// Serialize/Deserialize user (cần thiết cho session)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// Middleware Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---

// 1. Route bắt đầu Login bằng Google
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Route Callback (Google trả về đây)
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Đăng nhập thành công, req.user đã có dữ liệu
        const user = req.user;

        // Tạo JWT Token (giống như lúc login thường)
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key', // Nhớ thêm biến này vào .env
            { expiresIn: '1d' }
        );
        const frontendURL = "http://localhost:3000";

        // QUAN TRỌNG: Chuyển hướng về Frontend (Next.js port 3000)
        // Kèm theo token trên URL để Frontend lấy được
        res.redirect(`${frontendURL}/auth/google-success?token=${token}&role=${user.role}`);
    }
);

// API Login thường (Code cũ của bạn giữ nguyên hoặc gộp vào đây)
app.post('/api/login', async (req, res) => {
    // ... logic login email/pass của bạn
});

app.listen(PORT, () => {
    console.log(`🚀 Server backend đang chạy tại: http://localhost:${PORT}`);
});