// ==========================================
// CONTROLLER: USERS & AUTHENTICATION
// ==========================================
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sanitizePlainText, isValidEmail, verifyPassword, isBcryptHash } = require('../utils/sanitize');

// GET Semua Users
async function getUsers(req, res) {
  try {
    // password TIDAK di-select di sini - sudah aman dari kode asli
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
}
// DELETE User berdasarkan ID
async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan!' });
    }

    res.json({ success: true, message: 'User berhasil dihapus!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


// POST Tambah User Baru
async function addUser(req, res) {
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
    // Password baru selalu di-hash dengan bcrypt sebelum disimpan. Kolom
    // `password` di DB tidak perlu diubah (tetap VARCHAR/TEXT) karena
    // hash bcrypt juga berupa string.
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
}

// POST Login User
async function login(req, res) {
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

    // Pesan error digeneralisasi ("Email atau password salah") baik saat
    // email tidak ditemukan maupun password salah, supaya penyerang tidak
    // bisa memakai respons untuk menebak email mana yang terdaftar
    // (user enumeration).
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah!' });
    }

    const user = rows[0];
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah!' });
    }

    // Migrasi otomatis: jika password lama masih plain text tapi berhasil
    // cocok, langsung upgrade ke hash bcrypt di database secara diam-diam.
    if (!isBcryptHash(user.password)) {
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
}


module.exports = { getUsers, addUser, login, deleteUser };
