// ==========================================
// CONTROLLER: BERITA
// ==========================================
const pool = require('../config/db');
const { sanitizePlainText, sanitizeRichText } = require('../utils/sanitize');

// GET Semua Berita (Mendukung Pencarian ?q= / ?search= dan Filter Kategori)
async function getBerita(req, res) {
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
    // Query parameterized $1 -> aman dari SQL Injection meski keyword bebas
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
  // judul: teks polos saja. konten: rich-text yang disaring dari
  // tag/atribut berbahaya (script, onerror, iframe, dst).
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
    const gambarString = (req.files && req.files.length > 0) ? req.files.map(f => f.filename).join(',') : oldBerita.gambar;

    const updateQuery = `UPDATE berita SET judul = $1, konten = $2, kategori_id = $3, gambar = $4 WHERE id = $5 RETURNING *`;
    const values = [judul || oldBerita.judul, konten || oldBerita.konten, kategori_id || oldBerita.kategori_id, gambarString, id];

    const { rows } = await pool.query(updateQuery, values);
    res.json({ message: 'Berita berhasil diperbarui', data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE Berita
async function deleteBerita(req, res) {
  try {
    await pool.query('DELETE FROM berita WHERE id = $1', [req.params.id]);
    res.json({ message: 'Berita berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getBerita, getBeritaById, createBerita, updateBerita, deleteBerita };
