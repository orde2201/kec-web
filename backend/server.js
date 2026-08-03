require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// --- PAKET KEAMANAN TAMBAHAN (baru) ---
// Jalankan terlebih dahulu di terminal server:
//   npm install helmet express-rate-limit sanitize-html bcryptjs
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const bcrypt = require('bcryptjs');

// ==========================================
// 0. PERINGATAN KREDENSIAL DEFAULT (baru)
// ==========================================
// Kode asli menggunakan nilai default (fallback) untuk password DB & email
// jika file .env tidak diisi. Ini memudahkan development, TAPI SANGAT
// BERBAHAYA jika terbawa ke production. Blok ini hanya memberi peringatan
// di log, tidak menghentikan server, supaya fungsi yang sudah berjalan
// (sesuai koneksi database saat ini) tidak terganggu.
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

// ==========================================
// 1. INISIALISASI APP & KONFIGURASI DATABASE
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi koneksi PostgreSQL
// (DITAMBAHKAN) max/idleTimeoutMillis/connectionTimeoutMillis agar pool
// tidak membuka koneksi tak terbatas dan tidak menggantung selamanya
// ketika database lambat merespons.
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'database',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// (PENTING - PERBAIKAN BUG KRITIS) node-postgres akan MEMATIKAN seluruh
// proses Node.js jika sebuah idle client di dalam pool memunculkan event
// 'error' (misalnya koneksi terputus sesaat) dan event itu tidak ada yang
// menangani. Listener di bawah ini mencegah server crash mendadak akibat
// gangguan jaringan/database sesaat, tanpa mengubah cara query dijalankan.
pool.on('error', (err) => {
  console.error('⚠️  Kesalahan tak terduga pada idle client PostgreSQL (server tetap berjalan):', err.message);
});

// Tes Koneksi Database (tidak diubah - hanya menambahkan pesan log)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database PostgreSQL:', err.stack);
    return;
  }
  console.log('✅ Terhubung ke database PostgreSQL');
  release();
});

// ==========================================
// 1B. HELPER SANITASI & VALIDASI INPUT (baru)
// ==========================================
// Semua helper di bawah ini dipakai di endpoint-endpoint sebelum data
// disimpan ke database atau dikirim lewat email, untuk mencegah:
//  - XSS (Cross-Site Scripting) via judul/konten yang berisi <script>
//  - HTML/Header Injection pada email notifikasi
//  - Data "sampah" (whitespace, tipe data salah) masuk ke kolom DB

// Untuk field yang TIDAK BOLEH mengandung tag HTML sama sekali
// (nama kategori, nama instansi, judul, nama user, slug, dsb).
function sanitizePlainText(input) {
  if (input === undefined || input === null) return input;
  return sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} }).trim();
}

// Untuk field "rich text" yang boleh mengandung tag HTML dasar
// (konten berita, isi pengumuman, deskripsi about, dll) — tag berbahaya
// seperti <script>, <iframe>, atau atribut onerror/onclick akan dibuang.
function sanitizeRichText(input) {
  if (input === undefined || input === null) return input;
  return sanitizeHtml(String(input), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  }).trim();
}

// Untuk menyisipkan teks polos (judul, nama target, dsb) ke dalam HTML
// email tanpa risiko HTML/script injection dari pengirim.
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

// Memastikan link (mis. link_gform) benar-benar URL http/https yang valid,
// bukan skema berbahaya seperti javascript: atau data:
function isValidHttpUrl(str) {
  if (!str) return true; // kolom opsional, boleh kosong
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// (PENTING) Verifikasi password dengan dukungan migrasi bertahap dari
// password lama yang tersimpan plain text ke bcrypt, tanpa mengunci akun
// lama dan tanpa mengubah struktur tabel `users`.
async function verifyPassword(plainPassword, storedPassword) {
  const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword || '');
  if (isBcryptHash) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  // Fallback: akun lama yang password-nya belum di-hash.
  return plainPassword === storedPassword;
}

// ==========================================
// 2. KONFIGURASI NODEMAILER (PENGIRIM EMAIL)
// ==========================================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'email.instansi@gmail.com',
    pass: process.env.EMAIL_PASS || 'password-aplikasi-smtp',
  },
});

// Helper: Kirim Email Notifikasi Pengumuman
async function kirimEmailPengumuman({ id, judul, isi, link_gform, targetInstansiId }) {
  try {
    let emailQuery = '';
    let queryParams = [];

    if (!targetInstansiId || targetInstansiId == '1') {
      emailQuery = `SELECT email FROM users WHERE email IS NOT NULL AND email != ''`;
    } else {
      emailQuery = `SELECT email FROM users WHERE instansi_id = $1 AND email IS NOT NULL AND email != ''`;
      queryParams.push(targetInstansiId);
    }

    const { rows } = await pool.query(emailQuery, queryParams);
    // (DITAMBAHKAN) filter tambahan memastikan hanya format email yang valid
    // yang dipakai sebagai penerima (mencegah header injection lewat BCC).
    const emailList = rows.map(u => u.email).filter(e => isValidEmail(e));

    if (emailList.length === 0) {
      console.log('ℹ️ Tidak ada email user yang ditemukan untuk target instansi ini.');
      return;
    }

    let namaTarget = 'Everyone / Publik';
    if (targetInstansiId && targetInstansiId != '1') {
      const resInstansi = await pool.query('SELECT nama_instansi FROM instansi WHERE id = $1', [targetInstansiId]);
      if (resInstansi.rows.length > 0) {
        namaTarget = resInstansi.rows[0].nama_instansi;
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4000';
    const linkPengumumanPortal = `${frontendUrl}/detail-pengumuman.html?id=${encodeURIComponent(id)}`;

    // (DIAMANKAN) judul & namaTarget di-escape karena teks polos yang
    // disisipkan langsung ke HTML email. `isi` sudah disanitasi rich-text
    // sebelum disimpan ke DB (lihat endpoint POST/PUT /api/pengumuman),
    // sehingga aman ditampilkan sebagai HTML di sini.
    const safeJudul = escapeHtml(judul);
    const safeNamaTarget = escapeHtml(namaTarget);
    const safeLink = escapeHtml(linkPengumumanPortal);
    const safeLinkGform = link_gform && isValidHttpUrl(link_gform) ? escapeHtml(link_gform) : null;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Portal Kecamatan Rumbia'}" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      bcc: emailList,
      subject: `[PENGUMUMAN - KEC RUMBIA untuk ${namaTarget}] ${judul}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <h2 style="color: #0d6efd; margin-top: 0;">${safeJudul}</h2>
          <p style="font-size: 13px; color: #6c757d;">Target Instansi: <strong>${safeNamaTarget}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
          
          <div style="font-size: 15px; margin-bottom: 20px; white-space: pre-line;">
            ${isi}
          </div>

          <div style="margin-top: 25px; text-align: center;">
            <a href="${safeLink}" target="_blank" style="background-color: #0d6efd; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px;">
              🌐 Baca Pengumuman di Portal
            </a>
          </div>

          ${safeLinkGform ? `
            <div style="margin-top: 12px; text-align: center;">
              <a href="${safeLinkGform}" target="_blank" style="background-color: #198754; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px;">
                📋 Buka Form Lampiran / Google Form
              </a>
            </div>
          ` : ''}

          <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0 15px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">
            Jika tombol tidak bisa diklik, salin link berikut ke browser Anda:<br>
            <a href="${safeLink}" style="color: #0d6efd;">${safeLink}</a>
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notifikasi email berhasil dikirim ke ${emailList.length} user. Message ID: ${info.messageId}`);
  } catch (err) {
    console.error('❌ Gagal mengirim email pengumuman:', err.message);
  }
}

// ==========================================
// 3. MIDDLEWARE GLOBAL & MULTER
// ==========================================

// (BARU) Helmet menambahkan header keamanan standar (X-Content-Type-Options,
// X-Frame-Options, dsb). Content-Security-Policy sengaja dimatikan agar
// halaman statis lama (HTML/JS/CSS yang sudah ada) tidak tiba-tiba rusak;
// aktifkan & konfigurasikan CSP secara spesifik setelah frontend direview.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// (DIAMANKAN) CORS sekarang bisa dibatasi lewat env ALLOWED_ORIGINS
// (contoh: ALLOWED_ORIGINS=https://portal-rumbia.go.id,https://admin.portal-rumbia.go.id)
// Jika env tidak diisi, perilaku sama seperti sebelumnya (izinkan semua
// origin) supaya tidak ada fungsi yang tiba-tiba terputus.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!allowedOrigins || !origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin tidak diizinkan'));
  },
  credentials: true,
}));

// (DIAMANKAN) Batasi ukuran body request agar server tidak mudah dibanjiri
// payload raksasa (DoS sederhana). 2mb cukup untuk form JSON biasa;
// upload gambar tetap lewat multer (jalur terpisah, lihat limits di bawah).
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// (BARU) Rate limiter umum untuk seluruh endpoint /api, mencegah
// penyalahgunaan/spam request dari satu IP dalam jumlah besar.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan, silakan coba lagi nanti.' },
});
app.use('/api/', apiLimiter);

// (BARU) Rate limiter khusus login, jauh lebih ketat, untuk menghambat
// serangan brute-force menebak password.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});

// (DIAMANKAN) Blokir akses langsung ke berkas-berkas sensitif di root
// project (.env, server.js, package.json, folder .git/node_modules) yang
// sebelumnya ikut ter-expose oleh express.static(__dirname). File HTML/CSS/JS
// frontend yang memang publik tetap bisa diakses seperti biasa.
const BLOCKED_STATIC_PATTERNS = [
  /^\/\.env/i,
  /^\/server\.js$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/\.git(\/|$)/i,
  /^\/node_modules(\/|$)/i,
];
app.use((req, res, next) => {
  if (BLOCKED_STATIC_PATTERNS.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Izinkan Express melayani file statis HTML, CSS, & JS di folder utama
// (dotfiles: 'deny' menolak file yang diawali titik, mis. .env, .htaccess)
app.use(express.static(__dirname, { dotfiles: 'deny' }));

// Folder uploads aset gambar
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// (DIAMANKAN) Multer sekarang:
//  1. Hanya menerima ekstensi & mime-type gambar (mencegah upload .php/.js/.html)
//  2. Membuat nama file acak (crypto) agar tidak bisa ditebak/dioverwrite
//  3. Membatasi ukuran file (5MB) dan jumlah file per request
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

// ==========================================
// 4. ENDPOINTS MASTER KATEGORI & INSTANSI
// ==========================================

// GET Semua Kategori
app.get('/api/kategori', async (req, res) => {
  try {
    const query = 'SELECT id, nama_kategori FROM kategori_berita ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// POST Tambah Kategori Berita Baru
app.post('/api/kategori', async (req, res) => {
  const { nama_kategori } = req.body;
  if (!nama_kategori || nama_kategori.trim() === '') {
    return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi!' });
  }

  // (DIAMANKAN) sanitasi teks polos sebelum masuk ke query.
  // Query di bawah tetap memakai parameterized query ($1), jadi aman dari
  // SQL Injection; sanitasi ini mencegah tag HTML/script tersimpan di DB.
  const cleanNama = sanitizePlainText(nama_kategori);
  if (!cleanNama) {
    return res.status(400).json({ success: false, message: 'Nama kategori tidak valid!' });
  }

  try {
    const query = 'INSERT INTO kategori_berita (nama_kategori) VALUES ($1) RETURNING *';
    const { rows } = await pool.query(query, [cleanNama]);
    await pool.query("SELECT setval('kategori_berita_id_seq', (SELECT MAX(id) FROM kategori_berita))");
    res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan!', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Nama kategori tersebut sudah terdaftar!' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Semua Instansi
app.get('/api/instansi', async (req, res) => {
  try {
    const query = 'SELECT id, nama_instansi FROM instansi ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// POST Tambah Instansi
app.post('/api/instansi', async (req, res) => {
  const { nama_instansi } = req.body;
  if (!nama_instansi || nama_instansi.trim() === '') {
    return res.status(400).json({ success: false, message: 'Nama instansi wajib diisi!' });
  }

  const cleanNama = sanitizePlainText(nama_instansi);
  if (!cleanNama) {
    return res.status(400).json({ success: false, message: 'Nama instansi tidak valid!' });
  }

  try {
    const { rows } = await pool.query('INSERT INTO instansi (nama_instansi) VALUES ($1) RETURNING *', [cleanNama]);
    res.status(201).json({ success: true, message: 'Instansi berhasil ditambahkan!', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Nama instansi tersebut sudah terdaftar!' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. ENDPOINTS BERITA
// ==========================================

// GET Semua Berita (Mendukung Pencarian ?q= / ?search= dan Filter Kategori)
app.get('/api/berita', async (req, res) => {
  try {
    const { q, search, kategori_id } = req.query;
    const keyword = q || search; // Menerima parameter ?q= atau ?search=

    let query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      LEFT JOIN kategori_berita k ON b.kategori_id = k.id 
      LEFT JOIN users u ON b.penulis_id = u.id 
    `;

    let conditions = [];
    let params = [];

    // Filter Kata Kunci (Judul / Konten)
    // (Query parameterized $1 -> aman dari SQL Injection meski keyword bebas)
    if (keyword && keyword.trim() !== '') {
      params.push(`%${keyword.trim()}%`);
      conditions.push(`(b.judul ILIKE $${params.length} OR b.konten ILIKE $${params.length})`);
    }

    // Filter Kategori (Jika ada)
    if (kategori_id && kategori_id !== 'all' && kategori_id !== '') {
      params.push(kategori_id);
      conditions.push(`b.kategori_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.created_at DESC';

    const { rows } = await pool.query(query, params);

    // Kembalikan respon standar yang konsisten
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching berita:', err.message);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// DELETE Kategori Berita (Cek relasi dengan Berita)
app.delete('/api/kategori/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Cek apakah ada berita yang menggunakan kategori ini
    const checkBerita = await pool.query('SELECT COUNT(*) FROM berita WHERE kategori_id = $1', [id]);
    const countBerita = parseInt(checkBerita.rows[0].count);

    if (countBerita > 0) {
      return res.status(400).json({
        success: false,
        message: `Kategori tidak dapat dihapus karena masih digunakan oleh ${countBerita} berita. Hapus atau pindahkan berita terkait terlebih dahulu.`
      });
    }

    // 2. Eksekusi Hapus jika tidak ada keterkaitan
    const result = await pool.query('DELETE FROM kategori_berita WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE Instansi (Cek relasi dengan Users dan Pengumuman)
app.delete('/api/instansi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Cek keterkaitan dengan tabel Users
    const checkUser = await pool.query('SELECT COUNT(*) FROM users WHERE instansi_id = $1', [id]);
    const countUser = parseInt(checkUser.rows[0].count);

    // 2. Cek keterkaitan dengan tabel Pengumuman
    const checkPengumuman = await pool.query('SELECT COUNT(*) FROM pengumuman WHERE instansi_id = $1', [id]);
    const countPengumuman = parseInt(checkPengumuman.rows[0].count);

    if (countUser > 0 || countPengumuman > 0) {
      let detail = [];
      if (countUser > 0) detail.push(`${countUser} akun user`);
      if (countPengumuman > 0) detail.push(`${countPengumuman} pengumuman`);

      return res.status(400).json({
        success: false,
        message: `Instansi tidak dapat dihapus karena masih digunakan oleh ${detail.join(' dan ')}. Hapus atau pindahkan data terkait terlebih dahulu.`
      });
    }

    // 3. Eksekusi Hapus jika aman
    const result = await pool.query('DELETE FROM instansi WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Instansi tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Instansi berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Detail Berita
app.get('/api/berita/:id', async (req, res) => {
  try {
    const query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      LEFT JOIN kategori_berita k ON b.kategori_id = k.id 
      LEFT JOIN users u ON b.penulis_id = u.id 
      WHERE b.id = $1
    `;
    const { rows } = await pool.query(query, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Berita tidak ditemukan" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Tambah Berita
app.post('/api/berita', upload.array('gambar', 10), async (req, res) => {
  const { kategori_id, penulis_id } = req.body;
  // (DIAMANKAN) judul: teks polos saja. konten: rich-text yang disaring
  // dari tag/atribut berbahaya (script, onerror, iframe, dst).
  const judul = sanitizePlainText(req.body.judul);
  const konten = sanitizeRichText(req.body.konten);
  const gambarString = (req.files && req.files.length > 0) ? req.files.map(f => f.filename).join(',') : null;

  if (!judul || !konten) {
    return res.status(400).json({ error: 'Judul dan Konten wajib diisi!' });
  }

  try {
    const query = `INSERT INTO berita (judul, konten, gambar, kategori_id, penulis_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const values = [judul, konten, gambarString, kategori_id || 1, penulis_id || 1];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ message: 'Berita berhasil ditambahkan', data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Edit Berita
app.put('/api/berita/:id', upload.array('gambar', 10), async (req, res) => {
  const { id } = req.params;
  const { kategori_id } = req.body;
  const judul = req.body.judul !== undefined ? sanitizePlainText(req.body.judul) : undefined;
  const konten = req.body.konten !== undefined ? sanitizeRichText(req.body.konten) : undefined;

  try {
    const oldRes = await pool.query('SELECT * FROM berita WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: "Berita tidak ditemukan" });

    const oldBerita = oldRes.rows[0];
    const gambarString = (req.files && req.files.length > 0) ? req.files.map(f => f.filename).join(',') : oldBerita.gambar;

    const updateQuery = `UPDATE berita SET judul = $1, konten = $2, kategori_id = $3, gambar = $4 WHERE id = $5 RETURNING *`;
    const values = [judul || oldBerita.judul, konten || oldBerita.konten, kategori_id || oldBerita.kategori_id, gambarString, id];

    const { rows } = await pool.query(updateQuery, values);
    res.json({ message: 'Berita berhasil diperbarui', data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Berita
app.delete('/api/berita/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM berita WHERE id = $1', [req.params.id]);
    res.json({ message: 'Berita berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ENDPOINTS PENGUMUMAN
// ==========================================

// GET Pengumuman
app.get('/api/pengumuman', async (req, res) => {
  const { instansi_id } = req.query;
  try {
    let query = `SELECT p.*, i.nama_instansi FROM pengumuman p LEFT JOIN instansi i ON p.instansi_id = i.id`;
    let params = [];

    if (instansi_id === 'all') {
      query += ` ORDER BY p.created_at DESC`;
    } else if (instansi_id && instansi_id !== 'null' && instansi_id !== 'undefined' && instansi_id !== '') {
      query += ` WHERE p.instansi_id = $1 OR p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
      params.push(instansi_id);
    } else {
      query += ` WHERE p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Detail Pengumuman ID
app.get('/api/pengumuman/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, i.nama_instansi 
      FROM pengumuman p 
      LEFT JOIN instansi i ON p.instansi_id = i.id 
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Tambah Pengumuman
app.post('/api/pengumuman', upload.single('gambar'), async (req, res) => {
  const { instansi_id, kirim_email } = req.body;
  const judul = sanitizePlainText(req.body.judul);
  const isi = sanitizeRichText(req.body.isi);
  const link_gform = req.body.link_gform ? req.body.link_gform.trim() : null;
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !isi) {
    return res.status(400).json({ success: false, message: 'Judul dan isi pengumuman wajib diisi!' });
  }
  // (DIAMANKAN) validasi link agar bukan skema berbahaya (javascript:, data:, dst)
  if (link_gform && !isValidHttpUrl(link_gform)) {
    return res.status(400).json({ success: false, message: 'Link Google Form / lampiran tidak valid!' });
  }

  try {
    const targetInstansi = (instansi_id == '1' || !instansi_id) ? null : instansi_id;
    const query = `
      INSERT INTO pengumuman (judul, isi, instansi_id, link_gform, gambar) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    const values = [judul, isi, targetInstansi, link_gform || null, gambar];
    const { rows } = await pool.query(query, values);
    const newPengumuman = rows[0];

    if (kirim_email === 'true' || kirim_email === true) {
      kirimEmailPengumuman({
        id: newPengumuman.id,
        judul: newPengumuman.judul,
        isi: newPengumuman.isi,
        link_gform: newPengumuman.link_gform,
        targetInstansiId: newPengumuman.instansi_id
      });
    }

    res.status(201).json({ success: true, message: 'Pengumuman berhasil diterbitkan!', data: newPengumuman });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT Edit Pengumuman
app.put('/api/pengumuman/:id', upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { instansi_id, kirim_email } = req.body;
  const judul = req.body.judul !== undefined ? sanitizePlainText(req.body.judul) : undefined;
  const isi = req.body.isi !== undefined ? sanitizeRichText(req.body.isi) : undefined;
  const link_gform = req.body.link_gform !== undefined ? req.body.link_gform.trim() : undefined;

  if (link_gform && !isValidHttpUrl(link_gform)) {
    return res.status(400).json({ success: false, message: 'Link Google Form / lampiran tidak valid!' });
  }

  try {
    const oldRes = await pool.query('SELECT * FROM pengumuman WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' });
    }

    const oldData = oldRes.rows[0];
    const gambar = req.file ? req.file.filename : oldData.gambar;
    const targetInstansi = (instansi_id == '1' || !instansi_id) ? null : instansi_id;

    const updateQuery = `
      UPDATE pengumuman 
      SET judul = $1, isi = $2, instansi_id = $3, link_gform = $4, gambar = $5 
      WHERE id = $6 
      RETURNING *
    `;
    const values = [judul || oldData.judul, isi || oldData.isi, targetInstansi, link_gform || oldData.link_gform, gambar, id];
    const { rows } = await pool.query(updateQuery, values);
    const updatedPengumuman = rows[0];

    if (kirim_email === 'true' || kirim_email === true) {
      kirimEmailPengumuman({
        id: updatedPengumuman.id,
        judul: updatedPengumuman.judul,
        isi: updatedPengumuman.isi,
        link_gform: updatedPengumuman.link_gform,
        targetInstansiId: updatedPengumuman.instansi_id
      });
    }

    res.json({ success: true, message: 'Pengumuman berhasil diperbarui!', data: updatedPengumuman });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE Pengumuman
app.delete('/api/pengumuman/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pengumuman WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Pengumuman berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. ENDPOINT STORAGE STATS
// ==========================================
function getFolderSize(dirPath) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += getFolderSize(filePath);
    }
  }
  return totalSize;
}

app.get('/api/storage-stats', (req, res) => {
  try {
    const totalBytes = getFolderSize(uploadDir);
    const uploadsSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    const maxQuotaMB = parseInt(process.env.MAX_STORAGE_QUOTA_MB || '1024', 10);

    res.json({
      success: true,
      data: {
        uploadsSizeMB: uploadsSizeMB,
        maxQuotaMB: maxQuotaMB,
        freeDiskGB: 20,
        totalDiskGB: 50
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
});

// ==========================================
// 8. ENDPOINTS USERS & AUTHENTICATION
// ==========================================

// GET Semua Users
app.get('/api/users', async (req, res) => {
  try {
    // (password TIDAK di-select di sini - sudah aman di kode asli)
    const query = `
      SELECT u.id, u."Nama", u.email, u.phone, u."hakAkses", u.notes, u.instansi_id, i.nama_instansi 
      FROM users u 
      LEFT JOIN instansi i ON u.instansi_id = i.id 
      ORDER BY u.id ASC
    `;
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// POST Tambah User Baru
app.post('/api/add-users', async (req, res) => {
  const { password, phone, hakAkses, instansi_id, notes } = req.body;
  const Nama = sanitizePlainText(req.body.Nama);
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;

  if (!password) return res.status(400).json({ success: false, message: 'Password wajib diisi!' });
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password minimal 8 karakter!' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Format email tidak valid!' });
  }

  try {
    // (DIAMANKAN) Password baru selalu di-hash dengan bcrypt sebelum
    // disimpan. Kolom `password` di DB tidak perlu diubah (tetap VARCHAR/TEXT)
    // karena hash bcrypt juga berupa string.
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users ("Nama", email, password, phone, "hakAkses", instansi_id, notes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, "Nama", email, phone, "hakAkses", instansi_id, notes
    `;
    const values = [Nama, email, hashedPassword, phone, hakAkses || 'User', instansi_id, notes ? sanitizePlainText(notes) : null];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ success: true, message: 'User baru berhasil ditambahkan!', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Email tersebut sudah terdaftar!' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Login User
// (DIAMANKAN) loginLimiter membatasi jumlah percobaan login per IP.
app.post('/api/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi!' });
  }

  try {
    const query = `
      SELECT u.id, u."Nama", u.email, u.phone, u."hakAkses", u.instansi_id, u.password, i.nama_instansi 
      FROM users u
      LEFT JOIN instansi i ON u.instansi_id = i.id
      WHERE u.email = $1
    `;
    const { rows } = await pool.query(query, [email]);

    // (DIAMANKAN) pesan error digeneralisasi ("Email atau password salah")
    // baik saat email tidak ditemukan maupun password salah, supaya
    // penyerang tidak bisa memakai respons untuk menebak email mana yang
    // terdaftar (user enumeration).
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah!' });
    }

    const user = rows[0];
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah!' });
    }

    // (Migrasi otomatis) Jika password lama masih plain text tapi berhasil
    // cocok, langsung upgrade ke hash bcrypt di database secara diam-diam.
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password || '');
    if (!isBcryptHash) {
      try {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
      } catch (migrateErr) {
        console.error('⚠️ Gagal migrasi hash password user id', user.id, ':', migrateErr.message);
      }
    }

    delete user.password;
    res.json({ success: true, message: 'Login berhasil', user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. ENDPOINTS PENGATURAN (HERO, ABOUT, LOGO & FOOTER)
// ==========================================

// GET Pengaturan Halaman
app.get('/api/pengaturan', async (req, res) => {
  try {
    const query = 'SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1';
    const { rows } = await pool.query(query);
    res.json(rows.length > 0 ? rows[0] : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const pengaturanUpload = upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_image', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]);

const handlePengaturanUpdate = async (req, res) => {
  try {
    // (DIAMANKAN) about_desc & footer_about boleh mengandung HTML dasar
    // (rich text), sisanya teks polos saja.
    const about_title = sanitizePlainText(req.body.about_title);
    const about_desc = sanitizeRichText(req.body.about_desc);
    const footer_about = sanitizeRichText(req.body.footer_about);
    const footer_address = sanitizePlainText(req.body.footer_address);
    const footer_phone = sanitizePlainText(req.body.footer_phone);
    const footer_email = req.body.footer_email ? sanitizePlainText(req.body.footer_email) : req.body.footer_email;
    const footer_copyright = sanitizePlainText(req.body.footer_copyright);

    if (footer_email && !isValidEmail(footer_email)) {
      return res.status(400).json({ success: false, message: 'Format footer_email tidak valid!' });
    }

    const currentRes = await pool.query('SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1');
    const currentData = currentRes.rows[0];

    let hero_image = currentData ? currentData.hero_image : null;
    let about_image = currentData ? currentData.about_image : null;
    let logo = currentData ? currentData.logo : null;

    if (req.files && req.files['hero_image']) hero_image = req.files['hero_image'][0].filename;
    if (req.files && req.files['about_image']) about_image = req.files['about_image'][0].filename;
    if (req.files && req.files['logo']) logo = req.files['logo'][0].filename;

    if (currentData) {
      const updateQuery = `
        UPDATE pengaturan_halaman 
        SET hero_image = $1, 
            about_image = $2, 
            logo = $3, 
            about_title = $4, 
            about_desc = $5, 
            footer_about = $6, 
            footer_address = $7, 
            footer_phone = $8, 
            footer_email = $9, 
            footer_copyright = $10, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $11 RETURNING *
      `;
      const values = [
        hero_image, about_image, logo,
        about_title, about_desc,
        footer_about, footer_address, footer_phone, footer_email, footer_copyright,
        currentData.id
      ];
      const { rows } = await pool.query(updateQuery, values);
      res.json({ success: true, message: 'Pengaturan beranda & footer berhasil diupdate!', data: rows[0] });
    } else {
      const insertQuery = `
        INSERT INTO pengaturan_halaman 
        (hero_image, about_image, logo, about_title, about_desc, footer_about, footer_address, footer_phone, footer_email, footer_copyright) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
      `;
      const values = [
        hero_image, about_image, logo,
        about_title, about_desc,
        footer_about, footer_address, footer_phone, footer_email, footer_copyright
      ];
      const { rows } = await pool.query(insertQuery, values);
      res.json({ success: true, message: 'Pengaturan beranda & footer berhasil dibuat!', data: rows[0] });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

app.post('/api/pengaturan', pengaturanUpload, handlePengaturanUpdate);
app.post('/api/pengaturan/update', pengaturanUpload, handlePengaturanUpdate);

// ==========================================
// 10. ENDPOINTS HALAMAN KUSTOM (BLANK PAGE / NAVBAR MENU)
// ==========================================

// GET Semua Halaman Kustom
app.get('/api/halaman', async (req, res) => {
  try {
    const { header_only } = req.query;
    let query = 'SELECT * FROM halaman';
    if (header_only === 'true') {
      query += ' WHERE tampilkan_di_header = TRUE';
    }
    query += ' ORDER BY urutan ASC, id ASC';

    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Detail Halaman Kustom (Berdasarkan Slug atau ID)
app.get('/api/halaman/:slugOrId', async (req, res) => {
  const param = req.params.slugOrId;
  try {
    let query = 'SELECT * FROM halaman WHERE slug = $1';
    let values = [param];

    if (!isNaN(param)) {
      query = 'SELECT * FROM halaman WHERE id = $1 OR slug = $2';
      values = [parseInt(param), param];
    }

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Halaman tidak ditemukan!' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper lokal: ubah teks bebas menjadi slug URL yang aman
// (huruf kecil, angka, dan tanda "-" saja) — dipakai di POST & PUT /api/halaman
function buatSlug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// POST Tambah Halaman Baru (mendukung upload file gambar)
app.post('/api/halaman', upload.single('gambar'), async (req, res) => {
  const { tampilkan_di_header, urutan } = req.body;
  const judul = sanitizePlainText(req.body.judul);
  const konten = sanitizeRichText(req.body.konten);
  const slugInput = req.body.slug ? sanitizePlainText(req.body.slug) : '';
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !konten) {
    return res.status(400).json({ success: false, message: 'Judul dan Konten wajib diisi!' });
  }

  const cleanSlug = slugInput !== '' ? buatSlug(slugInput) : buatSlug(judul);

  try {
    const query = `
      INSERT INTO halaman (judul, slug, konten, gambar, tampilkan_di_header, urutan)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    // Pengecekan boolean yang fleksibel (menerima '1', 1, 'true', true dari form-data)
    const isHeader = (
      tampilkan_di_header === '1' ||
      tampilkan_di_header === 1 ||
      tampilkan_di_header === 'true' ||
      tampilkan_di_header === true
    );

    const values = [judul, cleanSlug, konten, gambar, isHeader, parseInt(urutan) || 1];

    const { rows } = await pool.query(query, values);
    res.status(201).json({ success: true, message: 'Halaman berhasil ditambahkan!', data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Slug URL halaman sudah digunakan!' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT Edit Halaman (mendukung update file gambar)
// (Catatan perbaikan: file asli memiliki DUA handler PUT /api/halaman/:id
// yang identik/duplikat — Express hanya pernah menjalankan handler pertama,
// sehingga handler kedua adalah kode mati. Duplikat tersebut dihapus di
// sini; perilaku endpoint untuk request yang valid tidak berubah.)
app.put('/api/halaman/:id', upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { tampilkan_di_header, urutan } = req.body;
  const judul = req.body.judul !== undefined ? sanitizePlainText(req.body.judul) : undefined;
  const konten = req.body.konten !== undefined ? sanitizeRichText(req.body.konten) : undefined;
  const slugInput = req.body.slug !== undefined ? sanitizePlainText(req.body.slug) : undefined;

  try {
    const oldRes = await pool.query('SELECT * FROM halaman WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Halaman tidak ditemukan!' });
    }

    const oldData = oldRes.rows[0];
    const newJudul = judul || oldData.judul;
    const cleanSlug = slugInput && slugInput !== '' ? buatSlug(slugInput) : oldData.slug;
    const newKonten = konten !== undefined ? konten : oldData.konten;

    // Pengecekan boolean yang fleksibel pada update
    const isHeader = tampilkan_di_header !== undefined
      ? (tampilkan_di_header === '1' || tampilkan_di_header === 1 || tampilkan_di_header === 'true' || tampilkan_di_header === true)
      : oldData.tampilkan_di_header;

    const newUrutan = urutan !== undefined ? parseInt(urutan) : oldData.urutan;
    const gambar = req.file ? req.file.filename : oldData.gambar;

    const updateQuery = `
      UPDATE halaman 
      SET judul = $1, slug = $2, konten = $3, gambar = $4, tampilkan_di_header = $5, urutan = $6 
      WHERE id = $7 RETURNING *
    `;
    const { rows } = await pool.query(updateQuery, [newJudul, cleanSlug, newKonten, gambar, isHeader, newUrutan, id]);
    res.json({ success: true, message: 'Halaman berhasil diperbarui!', data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE Halaman
app.delete('/api/halaman/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM halaman WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Halaman berhasil dihapus!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 11. ERROR HANDLING GLOBAL (baru)
// ==========================================
// Middleware di bawah ini TIDAK mengganggu koneksi database maupun
// endpoint yang sudah berjalan normal — hanya menangkap kasus-kasus
// yang sebelumnya tidak tertangani (route tak dikenal, error dari
// Multer, JSON body yang rusak) agar server tidak mengirim halaman
// error HTML mentah atau stack trace ke klien.

// 404 khusus untuk endpoint /api yang tidak dikenal
app.use('/api', (req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ success: false, message: 'Endpoint API tidak ditemukan.' });
});

// Error handler terpusat (harus punya 4 parameter agar dikenali Express)
app.use((err, req, res, next) => {
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
});

// ==========================================
// 12. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Backend server berjalan di port ${PORT}`);
});