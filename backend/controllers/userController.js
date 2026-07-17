const db = require('../config/db');

exports.addUser = async (req, res) => {
    const { Nama, email, phone, hakAkses, instansi_id, notes } = req.body;

    if (!Nama || !email || !phone || !hakAkses || !instansi_id) {
        return res.status(400).json({ success: false, message: 'Semua kolom wajib diisi.' });
    }

    const sql = `
        INSERT INTO users ("Nama", email, phone, "hakAkses", instansi_id, notes) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id;
    `;
    const values = [Nama, email, phone, hakAkses, instansi_id, notes];

    try {
        const result = await db.query(sql, values);
        res.status(201).json({ success: true, message: 'User berhasil ditambahkan!', userId: result.rows[0].id });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
        }
        res.status(500).json({ success: false, message: 'Error database: ' + err.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const sql = `SELECT id, "Nama", email, phone, "hakAkses", instansi_id, notes, created_at FROM users ORDER BY id DESC;`;
        const result = await db.query(sql);
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Gagal mengambil data dari database:', err.message);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengambil data.' });
    }
};