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

// Konfigurasi koneksi PostgreSQL (Sesuaikan dengan environment Anda)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'database', // Gunakan 'database' jika connect antar container Docker, atau 'localhost'
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// ==========================================
// 2. MIDDLEWARE GLOBAL
// ==========================================
app.use(cors()); // Mengizinkan semua origin sementara untuk development
app.use(express.json());
// Mengekspos folder uploads agar gambar bisa diakses dari URL browser
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 3. KONFIGURASI MULTER (UPLOAD GAMBAR)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Pastikan folder 'uploads' fisik sudah dibuat!
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


// ==========================================
// 4. ENDPOINTS API BERITA
// ==========================================

// A. Ambil Semua Berita (GET)
app.get('/api/berita', async (req, res) => {
  try {
    const query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      JOIN kategori_berita k ON b.kategori_id = k.id 
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

// B. Tambah Berita (POST)
app.post('/api/berita', upload.single('gambar'), async (req, res) => {
  const { judul, konten, kategori_id, penulis_id } = req.body;
  const gambar = req.file ? req.file.filename : null;

  try {
    const query = `
      INSERT INTO berita (judul, konten, gambar, kategori_id, penulis_id) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [judul, konten, gambar, kategori_id, penulis_id];
    const { rows } = await pool.query(query, values);
    res.status(201).json({ message: 'Berita berhasil ditambahkan', data: rows[0] });
  } catch (err) {
    console.error('Error POST /berita:', err);
    res.status(500).json({ error: err.message });
  }
});

// C. Hapus Berita (DELETE)
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
    
    // Jika ID tidak ditemukan di database
    if (rows.length === 0) {
      return res.status(404).json({ error: "Berita tidak ditemukan" });
    }
    
    // Kembalikan 1 baris data (object tunggal)
    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /berita/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

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


// ==========================================
// ENDPOINT MASTER INSTANSI & ADD USER
// ==========================================

// 1. Ambil Semua Instansi (Digunakan oleh Dropdown di add-user.html)
app.get('/api/instansi', async (req, res) => {
  try {
    const query = 'SELECT id, nama_instansi FROM instansi ORDER BY id ASC';
    const { rows } = await pool.query(query);
    
    // Kirim response { success: true, data: [...] } sesuai kebutuhan add-user.html
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error GET /api/instansi:', err);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
});

// 2. Tambah User Baru (Dikirim oleh Form Submit di add-user.html)
app.post('/api/add-users', async (req, res) => {
  const { Nama, email, phone, hakAkses, instansi_id, notes } = req.body;

  try {
    // Memakai kutip ganda "Nama" dan "hakAkses" menyesuaikan skema tabel Postgres Anda
    const query = `
      INSERT INTO users ("Nama", email, phone, "hakAkses", instansi_id, notes) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    const values = [Nama, email, phone, hakAkses, instansi_id, notes || null];
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


// ==========================================
// 7. ENDPOINTS PENGATURAN BERANDA
// ==========================================

// A. Ambil Data Pengaturan Beranda (GET)
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

// B. Handler Update Pengaturan Beranda
const handlePengaturanUpdate = async (req, res) => {
  try {
    const { about_title, about_desc } = req.body;

    // Ambil data lama agar file gambar tidak terhapus jika admin hanya ubah teks
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
      // UPDATE data yang ada
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
      // INSERT baru jika database masih kosong
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

// Menerima POST pada kedua jalur URL untuk fleksibilitas panggilan frontend
app.post('/api/pengaturan', pengaturanUpload, handlePengaturanUpdate);
app.post('/api/pengaturan/update', pengaturanUpload, handlePengaturanUpdate);
// ==========================================
// 5. REGISTRASI ROUTE LAINNYA
// ==========================================
// Jika file routing sudah Anda buat di folder 'routes', buka (uncomment) baris di bawah ini.
// Jika belum, biarkan tetap dikomentari agar server tidak crash.

// const userRoutes = require('./routes/userRoutes');
// const instansiRoutes = require('./routes/instansiRoutes');
// const kategoriRoutes = require('./routes/kategoriRoutes');

// app.use('/api', userRoutes);
// app.use('/api', instansiRoutes);
// app.use('/api', kategoriRoutes);


// ==========================================
// 6. JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Backend server berjalan di port ${PORT}`);
});