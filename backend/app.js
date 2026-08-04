require('dotenv').config();
const express = require('express');
const path = require('path');


// Inisialisasi koneksi database & mailer di-load lebih dulu supaya
// pool.on('error') dan tes koneksi langsung aktif saat server start.
require('./config/db');
// Tambahkan baris ini di file server.js utama Anda
require('./config/waClient');
const waRoutes = require('./routes/waRoutes');



const {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  blockSensitiveFiles,
} = require('./middleware/security');
const { notFoundApi, globalErrorHandler } = require('./middleware/errorHandler');
const { uploadDir } = require('./middleware/upload');
const apiRoutes = require('./routes');

// ==========================================
// 0. PERINGATAN KREDENSIAL DEFAULT
// ==========================================
// Kode asli menggunakan nilai default (fallback) untuk password DB & email
// jika file .env tidak diisi. Ini memudahkan development, TAPI SANGAT
// BERBAHAYA jika terbawa ke production. Blok ini hanya memberi peringatan
// di log, tidak menghentikan server.
if (process.env.NODE_ENV === 'production') {
  const insecureDefaults = [];
  if (!process.env.DB_PASS) insecureDefaults.push('DB_PASS');
  if (!process.env.EMAIL_PASS) insecureDefaults.push('EMAIL_PASS');
  if (!process.env.ALLOWED_ORIGINS) insecureDefaults.push('ALLOWED_ORIGINS (CORS masih terbuka untuk semua origin)');
  if (insecureDefaults.length > 0) {
    console.warn(
      `⚠️  PERINGATAN KEAMANAN: variabel .env berikut belum diset dan memakai nilai default yang TIDAK AMAN untuk production: ${insecureDefaults.join(', ')}`
    );
  }
}

const app = express();
const PORT = process.env.PORT || 3000;


// ... middleware & route lainnya

// ==========================================
// 1. MIDDLEWARE GLOBAL
// ==========================================
app.use(helmetMiddleware);
app.use(corsMiddleware);

app.use('/api/wa', waRoutes);
// Batasi ukuran body request agar server tidak mudah dibanjiri payload
// raksasa (DoS sederhana). Upload gambar tetap lewat multer (jalur
// terpisah, lihat middleware/upload.js).
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Rate limiter umum untuk seluruh endpoint /api
app.use('/api/', apiLimiter);

// Blokir akses langsung ke berkas/folder sensitif (.env, source code, dll)
// sebelum file statis dilayani.
app.use(blockSensitiveFiles);

// Izinkan Express melayani file statis HTML, CSS, & JS di folder utama
// (dotfiles: 'deny' menolak file yang diawali titik, mis. .env, .htaccess)
app.use(express.static(path.join(__dirname), { dotfiles: 'deny' }));

// Folder uploads aset gambar
app.use('/uploads', express.static(uploadDir));

// ==========================================
// 2. ROUTES API
// ==========================================
app.use('/api', apiRoutes);

// ==========================================
// 3. ERROR HANDLING GLOBAL
// ==========================================
app.use('/api', notFoundApi);
app.use(globalErrorHandler);

// ==========================================
// 4. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Backend server berjalan di port ${PORT}`);
});

module.exports = app;
