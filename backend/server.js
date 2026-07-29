require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// ==========================================
// 1. INISIALISASI APP & KONFIGURASI DATABASE
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi koneksi PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'database',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Tes Koneksi Database
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Gagal terhubung ke database PostgreSQL:', err.stack);
  }
  console.log('✅ Terhubung ke database PostgreSQL');
  release();
});

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
    const emailList = rows.map(u => u.email).filter(Boolean);

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
    const linkPengumumanPortal = `${frontendUrl}/detail-pengumuman.html?id=${id}`;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Portal Kecamatan Rumbia'}" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      bcc: emailList,
      subject: `[PENGUMUMAN - KEC RUMBIA untuk ${namaTarget}] ${judul}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <h2 style="color: #0d6efd; margin-top: 0;">${judul}</h2>
          <p style="font-size: 13px; color: #6c757d;">Target Instansi: <strong>${namaTarget}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
          
          <div style="font-size: 15px; margin-bottom: 20px; white-space: pre-line;">
            ${isi}
          </div>

          <div style="margin-top: 25px; text-align: center;">
            <a href="${linkPengumumanPortal}" target="_blank" style="background-color: #0d6efd; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px;">
              🌐 Baca Pengumuman di Portal
            </a>
          </div>

          ${link_gform ? `
            <div style="margin-top: 12px; text-align: center;">
              <a href="${link_gform}" target="_blank" style="background-color: #198754; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px;">
                📋 Buka Form Lampiran / Google Form
              </a>
            </div>
          ` : ''}

          <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0 15px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">
            Jika tombol tidak bisa diklik, salin link berikut ke browser Anda:<br>
            <a href="${linkPengumumanPortal}" style="color: #0d6efd;">${linkPengumumanPortal}</a>
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Izinkan Express melayani file statis HTML, CSS, & JS di folder utama
app.use(express.static(__dirname));

// Folder uploads aset gambar
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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

  const cleanNama = nama_kategori.trim();
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

  const cleanNama = nama_instansi.trim();
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

// GET Semua Berita
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
  const { judul, konten, kategori_id, penulis_id } = req.body;
  const gambarString = (req.files && req.files.length > 0) ? req.files.map(f => f.filename).join(',') : null;

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
  const { judul, konten, kategori_id } = req.body;

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
  const { judul, isi, instansi_id, link_gform, kirim_email } = req.body;
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !isi) {
    return res.status(400).json({ success: false, message: 'Judul dan isi pengumuman wajib diisi!' });
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
  const { judul, isi, instansi_id, link_gform, kirim_email } = req.body;

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
    const uploadDir = path.join(__dirname, 'uploads');
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
  const { Nama, email, password, phone, hakAkses, instansi_id, notes } = req.body;
  if (!password) return res.status(400).json({ success: false, message: 'Password wajib diisi!' });

  try {
    const query = `
      INSERT INTO users ("Nama", email, password, phone, "hakAkses", instansi_id, notes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, "Nama", email, phone, "hakAkses", instansi_id, notes
    `;
    const values = [Nama, email, password, phone, hakAkses || 'User', instansi_id, notes || null];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ success: true, message: 'User baru berhasil ditambahkan!', data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Login User
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const query = `
      SELECT u.id, u."Nama", u.email, u.phone, u."hakAkses", u.instansi_id, u.password, i.nama_instansi 
      FROM users u
      LEFT JOIN instansi i ON u.instansi_id = i.id
      WHERE u.email = $1
    `;
    const { rows } = await pool.query(query, [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Email tidak terdaftar!' });

    const user = rows[0];
    if (user.password !== password) return res.status(401).json({ success: false, message: 'Password salah!' });

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
    const { 
      about_title, 
      about_desc, 
      footer_about, 
      footer_address, 
      footer_phone, 
      footer_email, 
      footer_copyright 
    } = req.body;

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

// POST Tambah Halaman Baru (DISESUAIKAN: Mendukung upload file gambar)
// POST Tambah Halaman Baru
app.post('/api/halaman', upload.single('gambar'), async (req, res) => {
  const { judul, slug, konten, tampilkan_di_header, urutan } = req.body;
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !konten) {
    return res.status(400).json({ success: false, message: 'Judul dan Konten wajib diisi!' });
  }

  const cleanSlug = slug && slug.trim() !== '' 
    ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : judul.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  try {
    const query = `
      INSERT INTO halaman (judul, slug, konten, gambar, tampilkan_di_header, urutan)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    // PERBAIKAN PENTING: Pengecekan boolean yang fleksibel
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

// PUT Edit Halaman
app.put('/api/halaman/:id', upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { judul, slug, konten, tampilkan_di_header, urutan } = req.body;

  try {
    const oldRes = await pool.query('SELECT * FROM halaman WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Halaman tidak ditemukan!' });
    }

    const oldData = oldRes.rows[0];
    const newJudul = judul || oldData.judul;
    const cleanSlug = slug && slug.trim() !== '' 
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      : oldData.slug;
    const newKonten = konten !== undefined ? konten : oldData.konten;
    
    // PERBAIKAN PENTING: Pengecekan boolean yang fleksibel pada update
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

// PUT Edit Halaman (DISESUAIKAN: Mendukung update file gambar)
app.put('/api/halaman/:id', upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { judul, slug, konten, tampilkan_di_header, urutan } = req.body;

  try {
    const oldRes = await pool.query('SELECT * FROM halaman WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Halaman tidak ditemukan!' });
    }

    const oldData = oldRes.rows[0];
    const newJudul = judul || oldData.judul;
    const cleanSlug = slug && slug.trim() !== '' 
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      : oldData.slug;
    const newKonten = konten !== undefined ? konten : oldData.konten;
    const isHeader = tampilkan_di_header !== undefined ? (tampilkan_di_header === 'true' || tampilkan_di_header === true) : oldData.tampilkan_di_header;
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
// 11. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Backend server berjalan di port ${PORT}`);
});