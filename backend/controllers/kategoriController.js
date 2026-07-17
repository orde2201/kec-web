const db = require('../config/db');

exports.addKategori = async (req, res) => {
    const { namaKategori } = req.body;
    if (!namaKategori) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });

    try {
        const sql = `INSERT INTO kategori_berita (nama_kategori) VALUES ($1) RETURNING id;`;
        const result = await db.query(sql, [namaKategori]);
        res.status(201).json({ success: true, message: 'Kategori berita berhasil ditambahkan!', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, message: 'Kategori ini sudah ada.' });
        res.status(500).json({ success: false, message: 'Error server: ' + err.message });
    }
};

exports.getAllKategori = async (req, res) => {
    try {
        const result = await db.query('SELECT id, nama_kategori FROM kategori_berita ORDER BY nama_kategori ASC;');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};