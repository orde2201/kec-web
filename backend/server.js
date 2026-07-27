require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');

// ==========================================
// 1. INISIALISASI APP & KONFIGURASI DATABASE
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi koneksi PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'database', // Gunakan 'database' untuk Docker Compose, atau 'localhost'
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// ==========================================
// 2. MIDDLEWARE GLOBAL
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 3. KONFIGURASI MULTER (UPLOAD GAMBAR)
// ==========================================
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

// A. Ambil Semua Kategori Berita (GET) - BARU
app.get('/api/kategori', async (req, res) => {
  try {
    const query = 'SELECT id, nama_kategori FROM kategori_berita ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error GET /api/kategori:', err);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// B. Ambil Semua Instansi (GET)
app.get('/api/instansi', async (req, res) => {
  try {
    const query = 'SELECT id, nama_instansi FROM instansi ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error GET /api/instansi:', err);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// C. Tambah Instansi Baru (+ OTOMATIS SYNC KE KATEGORI BERITA)
app.post('/api/instansi', async (req, res) => {
  const { nama_instansi } = req.body;

  if (!nama_instansi || nama_instansi.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Nama instansi wajib diisi!' 
    });
  }

  const cleanNama = nama_instansi.trim();

  try {
    // 1. Simpan ke tabel instansi
    const { rows } = await pool.query(
      'INSERT INTO instansi (nama_instansi) VALUES ($1) RETURNING *',
      [cleanNama]
    );
    const newInstansi = rows[0];

    // 2. Otomatis buatkan kategori_berita dengan ID & Nama yang sejajar
    await pool.query(
      'INSERT INTO kategori_berita (id, nama_kategori) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET nama_kategori = EXCLUDED.nama_kategori',
      [newInstansi.id, newInstansi.nama_instansi]
    );

    // 3. Sync Sequence Kategori
    await pool.query("SELECT setval('kategori_berita_id_seq', (SELECT MAX(id) FROM kategori_berita))");

    res.status(201).json({ 
      success: true, 
      message: 'Instansi & Kategori berhasil ditambahkan!', 
      data: newInstansi 
    });
  } catch (err) {
    console.error('Error POST /api/instansi:', err);
    if (err.code === '23505') {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama instansi tersebut sudah terdaftar di database!' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});


// ==========================================
// 5. ENDPOINTS API BERITA (CRUD LENGKAP)
// ==========================================

// A. Ambil Semua Berita (GET)
app.get('/api/berita', async (req, res) => {
  try {
    const query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      LEFT JOIN kategori_berita k ON b.kategori_id = k.id 
      LEFT JOIN users u ON b.penulis_id = u.id 
      ORDER BY b.created_at DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error GET /berita:', err);
    res.status(500).json({ error: err.message });
  }
});

// B. Detail Berita Berdasarkan ID (GET)
app.get('/api/berita/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      LEFT JOIN kategori_berita k ON b.kategori_id = k.id 
      LEFT JOIN users u ON b.penulis_id = u.id 
      WHERE b.id = $1
    `;
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Berita tidak ditemukan" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /berita/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// C. Tambah Berita (POST)
app.post('/api/berita', upload.single('gambar'), async (req, res) => {
  const { judul, konten, kategori_id, penulis_id } = req.body;
  const gambar = req.file ? req.file.filename : null;

  try {
    const query = `
      INSERT INTO berita (judul, konten, gambar, kategori_id, penulis_id) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [judul, konten, gambar, kategori_id || 1, penulis_id || 1];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ message: 'Berita berhasil ditambahkan', data: rows[0] });
  } catch (err) {
    console.error('Error POST /berita:', err);
    res.status(500).json({ error: err.message });
  }
});

// D. Edit / Update Berita (PUT) - BARU
app.put('/api/berita/:id', upload.single('gambar'), async (req, res) => {
  const { id } = req.params;
  const { judul, konten, kategori_id } = req.body;

  try {
    // Ambil berita lama
    const oldRes = await pool.query('SELECT * FROM berita WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: "Berita tidak ditemukan" });
    }

    const oldBerita = oldRes.rows[0];
    // Pakai gambar baru jika diupload, jika tidak gunakan gambar lama
    const gambar = req.file ? req.file.filename : oldBerita.gambar;

    const updateQuery = `
      UPDATE berita 
      SET judul = $1, konten = $2, kategori_id = $3, gambar = $4 
      WHERE id = $5 
      RETURNING *
    `;
    const values = [
      judul || oldBerita.judul, 
      konten || oldBerita.konten, 
      kategori_id || oldBerita.kategori_id, 
      gambar, 
      id
    ];

    const { rows } = await pool.query(updateQuery, values);
    res.json({ message: 'Berita berhasil diperbarui', data: rows[0] });

  } catch (err) {
    console.error('Error PUT /berita/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// E. Hapus Berita (DELETE)
app.delete('/api/berita/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM berita WHERE id = $1', [id]);
    res.json({ message: 'Berita berhasil dihapus' });
  } catch (err) {
    console.error('Error DELETE /berita:', err);
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 6. ENDPOINTS MASTER USERS & AUTHENTICATION
// ==========================================

// A. Ambil Semua Users (GET)
app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u."Nama", 
        u.email, 
        u.phone, 
        u."hakAkses", 
        u.notes, 
        u.instansi_id, 
        i.nama_instansi 
      FROM users u 
      LEFT JOIN instansi i ON u.instansi_id = i.id 
      ORDER BY u.id ASC
    `;
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error GET /api/users:', err);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// B. Tambah User Baru (POST)
app.post('/api/add-users', async (req, res) => {
  const { Nama, email, password, phone, hakAkses, instansi_id, notes } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password wajib diisi!' });
  }

  try {
    const query = `
      INSERT INTO users ("Nama", email, password, phone, "hakAkses", instansi_id, notes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, "Nama", email, phone, "hakAkses", instansi_id, notes
    `;
    const values = [Nama, email, password, phone, hakAkses, instansi_id, notes || null];
    const { rows } = await pool.query(query, values);

    res.status(201).json({ 
      success: true, 
      message: 'User baru berhasil ditambahkan!', 
      data: rows[0] 
    });
  } catch (err) {
    console.error('Error POST /api/add-users:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// C. Login User (POST)
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

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email tidak terdaftar!' });
    }

    const user = rows[0];

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Password salah!' });
    }

    delete user.password;

    res.json({
      success: true,
      message: 'Login berhasil',
      user: user
    });

  } catch (error) {
    console.error('Error Login:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem: ' + error.message });
  }
});

// D. Pengumuman (GET)
// ==========================================
// ENDPOINTS PENGUMUMAN (STRICT INSTANSI FILTER)
// ==========================================

// A. Ambil Pengumuman (Disesuaikan Hak Akses User)
// ==========================================
// ENDPOINTS PENGUMUMAN (SUPPORT ARCHIVE & 'ALL')
// ==========================================

// A. Ambil Pengumuman (Disesuaikan Hak Akses User / Admin / Archive)
app.get('/api/pengumuman', async (req, res) => {
  const { instansi_id } = req.query;

  try {
    let query = `
      SELECT p.*, i.nama_instansi 
      FROM pengumuman p
      LEFT JOIN instansi i ON p.instansi_id = i.id
    `;
    let params = [];

    // 1. KASUS ADMIN / ARSIP SEMUA PENGUMUMAN (instansi_id = 'all')
    if (instansi_id === 'all') {
      // Ambil SEMUA pengumuman tanpa filter
      query += ` ORDER BY p.created_at DESC`;
    } 
    // 2. KASUS USER LOGIN (Memiliki ID Instansi Spesifik)
    else if (instansi_id && instansi_id !== 'null' && instansi_id !== 'undefined' && instansi_id !== '') {
      // Tampilkan HANYA Pengumuman Instansinya + Pengumuman Publik (NULL atau ID 1)
      query += ` WHERE p.instansi_id = $1 OR p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
      params.push(instansi_id);
    } 
    // 3. KASUS PUBLIK / BELUM LOGIN
    else {
      // HANYA tampilkan pengumuman Publik (NULL atau ID 1)
      query += ` WHERE p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });

  } catch (error) {
    console.error('Error GET Pengumuman:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pengumuman: ' + error.message });
  }
});

// B. Tambah Pengumuman Baru (Khusus Admin dari Dashboard)
// Tambah Pengumuman Baru (Support Upload Gambar Surat & Link Google Form)
app.post('/api/pengumuman', upload.single('gambar'), async (req, res) => {
  const { judul, isi, instansi_id, link_gform } = req.body;
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !isi) {
    return res.status(400).json({ success: false, message: 'Judul dan isi pengumuman wajib diisi!' });
  }

  try {
    // Jika instansi_id '1' atau kosong, jadikan NULL (Publik/Everyone)
    const targetInstansi = (instansi_id == '1' || !instansi_id) ? null : instansi_id;

    const query = `
      INSERT INTO pengumuman (judul, isi, instansi_id, link_gform, gambar) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    const values = [judul, isi, targetInstansi, link_gform || null, gambar];
    const { rows } = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Pengumuman berhasil ditambahkan!',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error POST Pengumuman:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// C. Hapus Pengumuman
app.delete('/api/pengumuman/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM pengumuman WHERE id = $1', [id]);
    res.json({ success: true, message: 'Pengumuman berhasil dihapus' });
  } catch (error) {
    console.error('Error DELETE Pengumuman:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. ENDPOINTS PENGATURAN BERANDA
// ==========================================

app.get('/api/pengaturan', async (req, res) => {
  try {
    const query = 'SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1';
    const { rows } = await pool.query(query);
    
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'Data pengaturan belum ada di database' });
    }
  } catch (err) {
    console.error('Error GET /api/pengaturan:', err);
    res.status(500).json({ error: err.message });
  }
});

const handlePengaturanUpdate = async (req, res) => {
  try {
    const { about_title, about_desc } = req.body;

    const currentRes = await pool.query('SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1');
    const currentData = currentRes.rows[0];

    let hero_image = currentData ? currentData.hero_image : null;
    let about_image = currentData ? currentData.about_image : null;

    if (req.files && req.files['hero_image']) {
      hero_image = req.files['hero_image'][0].filename;
    }
    if (req.files && req.files['about_image']) {
      about_image = req.files['about_image'][0].filename;
    }

    if (currentData) {
      const updateQuery = `
        UPDATE pengaturan_halaman 
        SET hero_image = $1, 
            about_image = $2, 
            about_title = $3, 
            about_desc = $4, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $5 
        RETURNING *
      `;
      const values = [hero_image, about_image, about_title, about_desc, currentData.id];
      const { rows } = await pool.query(updateQuery, values);

      res.json({ success: true, message: 'Pengaturan beranda berhasil diupdate!', data: rows[0] });
    } else {
      const insertQuery = `
        INSERT INTO pengaturan_halaman (hero_image, about_image, about_title, about_desc) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
      `;
      const values = [hero_image, about_image, about_title, about_desc];
      const { rows } = await pool.query(insertQuery, values);

      res.json({ success: true, message: 'Pengaturan beranda berhasil dibuat!', data: rows[0] });
    }
  } catch (err) {
    console.error('Error Update Pengaturan:', err);
    res.status(500).json({ success: false, message: 'Gagal update beranda: ' + err.message });
  }
};

const pengaturanUpload = upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_image', maxCount: 1 }
]);

app.post('/api/pengaturan', pengaturanUpload, handlePengaturanUpdate);
app.post('/api/pengaturan/update', pengaturanUpload, handlePengaturanUpdate);


// ==========================================
// 8. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Backend server berjalan di port ${PORT}`);
});