// ==========================================
// CONTROLLER: HALAMAN KUSTOM (BLANK PAGE / NAVBAR MENU)
// ==========================================
const pool = require('../config/db');
const { sanitizePlainText, sanitizeRichText, buatSlug } = require('../utils/sanitize');

// GET Semua Halaman Kustom
async function getHalaman(req, res) {
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
}

// GET Detail Halaman Kustom (Berdasarkan Slug atau ID)
async function getHalamanDetail(req, res) {
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
}

// POST Tambah Halaman Baru (mendukung upload file gambar)
async function createHalaman(req, res) {
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
}

// PUT Edit Halaman (mendukung update file gambar)
// Catatan: file server.js asli sempat memiliki DUA handler PUT
// /api/halaman/:id yang identik/duplikat — Express hanya pernah
// menjalankan handler pertama, sehingga handler kedua adalah kode mati.
// Di struktur baru ini hanya ada satu fungsi, jadi duplikasi tersebut
// otomatis hilang tanpa mengubah perilaku endpoint untuk request yang valid.
async function updateHalaman(req, res) {
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
}

// DELETE Halaman
async function deleteHalaman(req, res) {
  try {
    await pool.query('DELETE FROM halaman WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Halaman berhasil dihapus!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getHalaman, getHalamanDetail, createHalaman, updateHalaman, deleteHalaman };
