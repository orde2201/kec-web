// ==========================================
// MIDDLEWARE KEAMANAN GLOBAL
// ==========================================
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Helmet menambahkan header keamanan standar (X-Content-Type-Options,
// X-Frame-Options, dsb). Content-Security-Policy sengaja dimatikan agar
// halaman statis lama (HTML/JS/CSS yang sudah ada) tidak tiba-tiba rusak;
// aktifkan & konfigurasikan CSP secara spesifik setelah frontend direview.
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// CORS bisa dibatasi lewat env ALLOWED_ORIGINS (contoh:
// ALLOWED_ORIGINS=https://portal-rumbia.go.id,https://admin.portal-rumbia.go.id)
// Jika env tidak diisi, izinkan semua origin (perilaku default lama).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!allowedOrigins || !origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin tidak diizinkan'));
  },
  credentials: true,
});

// Rate limiter umum untuk seluruh endpoint /api, mencegah penyalahgunaan/
// spam request dari satu IP dalam jumlah besar.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan, silakan coba lagi nanti.' },
});

// Rate limiter khusus login, jauh lebih ketat, untuk menghambat serangan
// brute-force menebak password.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});

// Blokir akses langsung ke berkas-berkas sensitif di root project (.env,
// server.js, package.json, folder .git/node_modules) yang sebelumnya ikut
// ter-expose oleh express.static(__dirname). File HTML/CSS/JS frontend
// yang memang publik tetap bisa diakses seperti biasa.
const BLOCKED_STATIC_PATTERNS = [
  /^\/\.env/i,
  /^\/server\.js$/i,
  /^\/app\.js$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/\.git(\/|$)/i,
  /^\/node_modules(\/|$)/i,
  /^\/(config|controllers|routes|middleware|services|utils)(\/|$)/i,
];

function blockSensitiveFiles(req, res, next) {
  if (BLOCKED_STATIC_PATTERNS.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  next();
}

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  loginLimiter,
  blockSensitiveFiles,
};
