require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
// Khi chạy local thì dùng localhost, lên Vercel thì lấy từ biến môi trường
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// --- CẤU HÌNH CORS ---
app.use(cors({
    origin: FRONTEND_URL, // Chỉ cho phép Frontend này gọi
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- KẾT NỐI MONGODB (Tối ưu cho Serverless) ---
// Giúp tránh lỗi tạo quá nhiều kết nối mỗi lần gọi API
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log('✅ Đã kết nối MongoDB');
    } catch (err) {
        console.error('❌ Lỗi kết nối MongoDB:', err);
    }
};
// Gọi kết nối ngay
connectDB();

// --- SCHEMA USER ---
const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    avatar: String,
    role: { type: String, default: 'user' }
});
// Kiểm tra xem model đã tồn tại chưa để tránh lỗi OverwriteModelError khi hot-reload
const User = mongoose.models.User || mongoose.model('User', userSchema);

// --- CẤU HÌNH PASSPORT ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Callback URL phải động theo môi trường (Local hoặc Vercel)
    callbackURL: `${BACKEND_URL}/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        await connectDB(); // Đảm bảo DB đã kết nối
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

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    await connectDB();
    const user = await User.findById(id);
    done(null, user);
});

// Middleware Session
// Lưu ý: Trên Vercel miễn phí, session lưu trong memory sẽ mất sau mỗi request.
// Tuy nhiên với flow Login Google -> Redirect ngay lập tức thì vẫn tạm ổn.
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // True nếu chạy https (vercel)
        maxAge: 60000 
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send("Backend API is running!");
});

// 1. Route bắt đầu Login bằng Google
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Route Callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        const user = req.user;
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '1d' }
        );

        // Redirect về Frontend kèm token
        res.redirect(`${FRONTEND_URL}/auth/google-success?token=${token}&role=${user.role}`);
    }
);
app.get('/', (req, res) => {
    res.send("<h1>Backend đang chạy ngon lành! 🚀</h1>");
});
// API Login thường
app.post('/api/login', async (req, res) => {
    await connectDB();
    // Logic login của bạn...
    res.json({ message: "Login endpoint" });
});

// --- QUAN TRỌNG: CẤU HÌNH CHO VERCEL ---
// Export app để Vercel sử dụng
module.exports = app;


// Chỉ chạy app.listen khi ở môi trường local (development)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
        console.log(`🚀 Server backend đang chạy tại: http://localhost:${PORT}`);
    });
}