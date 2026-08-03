// ==========================================
// MIDDLEWARE UPLOAD FILE (MULTER)
// ==========================================
// - Hanya menerima ekstensi & mime-type gambar (mencegah upload .php/.js/.html)
// - Membuat nama file acak (crypto) agar tidak bisa ditebak/dioverwrite
// - Membatasi ukuran file (5MB) dan jumlah file per request
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(ext)) {
      return cb(new Error('Ekstensi file tidak diizinkan. Hanya jpg, jpeg, png, gif, webp, svg.'));
    }
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${randomName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    return cb(new Error('Tipe file tidak didukung. Hanya gambar (jpg, png, gif, webp, svg) yang diizinkan.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB per file, maks 10 file
});

module.exports = { upload, uploadDir };
