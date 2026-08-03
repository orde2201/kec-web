// ==========================================
// ERROR HANDLING GLOBAL
// ==========================================
// Menangkap kasus yang sebelumnya tidak tertangani (route tak dikenal,
// error dari Multer, JSON body yang rusak) agar server tidak mengirim
// halaman error HTML mentah atau stack trace ke klien.
const multer = require('multer');

// 404 khusus untuk endpoint /api yang tidak dikenal
function notFoundApi(req, res, next) {
  if (res.headersSent) return next();
  res.status(404).json({ success: false, message: 'Endpoint API tidak ditemukan.' });
}

// Error handler terpusat (harus punya 4 parameter agar dikenali Express)
function globalErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Contoh: file terlalu besar (LIMIT_FILE_SIZE), terlalu banyak file, dst.
    return res.status(400).json({ success: false, message: `Upload gagal: ${err.message}` });
  }
  if (err && err.message && err.message.includes('tidak diizinkan')) {
    // Error kustom dari fileFilter/filename di konfigurasi Multer.
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON pada request tidak valid.' });
  }
  if (err && err.message === 'CORS: Origin tidak diizinkan') {
    return res.status(403).json({ success: false, message: 'Akses ditolak (CORS).' });
  }
  console.error('❌ Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
}

module.exports = { notFoundApi, globalErrorHandler };
