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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// --- CẤU HÌNH CORS ---
app.use(cors({
    origin: FRONTEND_URL, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- KẾT NỐI MONGODB ---
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
connectDB();

// --- SCHEMA USER ---
const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    avatar: String,
    role: { type: String, default: 'user' }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

// --- CẤU HÌNH PASSPORT ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/auth/google/callback`,
    passReqToCallback: true, // Thêm dòng này cho chắc
    proxy: true,             // QUAN TRỌNG: Bắt buộc có trên Vercel để nhận diện HTTPS
    scope: ['profile', 'email'] // QUAN TRỌNG: Khai báo scope ngay tại đây luôn
}, async (req, accessToken, refreshToken, profile, done) => { 
    // Lưu ý: Có thêm tham số 'req' ở đầu do dòng passReqToCallback: true
    try {
        await connectDB();
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
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60000 
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- MIDDLEWARE CHECK TOKEN (Để bảo vệ API User) ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Thiếu Token' });

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, user) => {
        if (err) return res.status(403).json({ message: 'Token không hợp lệ' });
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// 1. Route Trang chủ (Để test server sống hay chết)
app.get('/', (req, res) => {
    res.send("<h1>Backend đang chạy ngon lành! 🚀</h1>");
});

// 2. Login Google
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 3. Callback Google
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        const user = req.user;
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '1d' }
        );
        // Redirect về Frontend
        res.redirect(`${FRONTEND_URL}/auth/google-success?token=${token}&role=${user.role}`);
    }
);

// 4. API Lấy thông tin User (Frontend gọi cái này)
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        await connectDB();
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User không tồn tại' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// 5. API Login thường (Placeholder)
app.post('/api/login', async (req, res) => {
    await connectDB();
    res.json({ message: "Login endpoint" });
});

// --- CẤU HÌNH VERCEL (QUAN TRỌNG) ---
module.exports = app;

// Chỉ chạy Local
if (require.main === module) {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy local tại port ${PORT}`);
    });
}