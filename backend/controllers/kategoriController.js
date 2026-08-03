// ==========================================
// CONTROLLER: KATEGORI BERITA
// ==========================================
const pool = require('../config/db');
const { sanitizePlainText } = require('../utils/sanitize');

// GET Semua Kategori
async function getKategori(req, res) {
  try {
    const query = 'SELECT id, nama_kategori FROM kategori_berita ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
}

// POST Tambah Kategori Berita Baru
async function createKategori(req, res) {
  const { nama_kategori } = req.body;
  if (!nama_kategori || nama_kategori.trim() === '') {
    return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi!' });
  }

  // Sanitasi teks polos sebelum masuk ke query. Query di bawah tetap
  // memakai parameterized query ($1), jadi aman dari SQL Injection;
  // sanitasi ini mencegah tag HTML/script tersimpan di DB.
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
}

// DELETE Kategori Berita (Cek relasi dengan Berita)
async function deleteKategori(req, res) {
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
}

module.exports = { getKategori, createKategori, deleteKategori };
