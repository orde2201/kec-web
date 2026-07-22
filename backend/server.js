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