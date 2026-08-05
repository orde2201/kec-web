// ==========================================
// CONTROLLER: BERITA
// ==========================================
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { sanitizePlainText, sanitizeRichText } = require('../utils/sanitize');

// Helper untuk menghapus file fisik dari folder uploads
function hapusFileGambar(gambarString) {
  if (!gambarString) return;

  // Split string nama file jika ada banyak gambar (misal: "img1.jpg,img2.jpg")
  const fileList = gambarString.split(',').map(f => f.trim()).filter(Boolean);

  fileList.forEach(fileName => {
    const filePath = path.join(__dirname, '../uploads', fileName);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Gagal menghapus file ${fileName}:`, err.message);
        } else {
          console.log(`Berhasil menghapus file: ${fileName}`);
        }
      });
    }
  });
}

// GET Semua Berita (Mendukung Pencarian ?q= / ?search= dan Filter Kategori)
async function getBerita(req, res) {
  try {
    const { q, search, kategori_id } = req.query;
    const keyword = q || search;

    let query = `
      SELECT b.*, k.nama_kategori, u."Nama" AS nama_penulis 
      FROM berita b 
      LEFT JOIN kategori_berita k ON b.kategori_id = k.id 
      LEFT JOIN users u ON b.penulis_id = u.id 
    `;

    let conditions = [];
    let params = [];

    if (keyword && keyword.trim() !== '') {
      params.push(`%${keyword.trim()}%`);
      conditions.push(`(b.judul ILIKE $${params.length} OR b.konten ILIKE $${params.length})`);
    }

    if (kategori_id && kategori_id !== 'all' && kategori_id !== '') {
      params.push(kategori_id);
      conditions.push(`b.kategori_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching berita:', err.message);
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
}

// GET Detail Berita
async function getBeritaById(req, res) {
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
}

// POST Tambah Berita
async function createBerita(req, res) {
  const { kategori_id, penulis_id } = req.body;
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
}

// PUT Edit Berita
async function updateBerita(req, res) {
  const { id } = req.params;
  const { kategori_id } = req.body;
  const judul = req.body.judul !== undefined ? sanitizePlainText(req.body.judul) : undefined;
  const konten = req.body.konten !== undefined ? sanitizeRichText(req.body.konten) : undefined;

  try {
    const oldRes = await pool.query('SELECT * FROM berita WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: "Berita tidak ditemukan" });

    const oldBerita = oldRes.rows[0];
    let gambarString = oldBerita.gambar;

    // Jika ada unggahan gambar baru, hapus gambar-gambar lama dan ganti dengan yang baru
    if (req.files && req.files.length > 0) {
      gambarString = req.files.map(f => f.filename).join(',');
      hapusFileGambar(oldBerita.gambar);
    }

    const updateQuery = `UPDATE berita SET judul = $1, konten = $2, kategori_id = $3, gambar = $4 WHERE id = $5 RETURNING *`;
    const values = [judul || oldBerita.judul, konten || oldBerita.konten, kategori_id || oldBerita.kategori_id, gambarString, id];

    const { rows } = await pool.query(updateQuery, values);
    res.json({ message: 'Berita berhasil diperbarui', data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE Berita (Termasuk Menghapus Semua File Gambar Terkait)
async function deleteBerita(req, res) {
  const { id } = req.params;
  try {
    // 1. Ambil data gambar berita sebelum dihapus
    const oldRes = await pool.query('SELECT gambar FROM berita WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: "Berita tidak ditemukan" });
    }

    const gambarString = oldRes.rows[0].gambar;

    // 2. Hapus data berita dari database
    await pool.query('DELETE FROM berita WHERE id = $1', [id]);

    // 3. Hapus semua file fisik gambar di folder uploads
    hapusFileGambar(gambarString);

    res.json({ message: 'Berita dan file gambar terkait berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getBerita, getBeritaById, createBerita, updateBerita, deleteBerita };