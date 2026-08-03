// ==========================================
// CONTROLLER: INSTANSI
// ==========================================
const pool = require('../config/db');
const { sanitizePlainText } = require('../utils/sanitize');

// GET Semua Instansi
async function getInstansi(req, res) {
  try {
    const query = 'SELECT id, nama_instansi FROM instansi ORDER BY id ASC';
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: [] });
  }
}

// POST Tambah Instansi
async function createInstansi(req, res) {
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
}

// DELETE Instansi (Cek relasi dengan Users dan Pengumuman)
async function deleteInstansi(req, res) {
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
}

module.exports = { getInstansi, createInstansi, deleteInstansi };
