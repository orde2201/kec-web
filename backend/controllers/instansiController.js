const db = require('../config/db');

exports.addInstansi = async (req, res) => {
    const { namaInstansi } = req.body;
    if (!namaInstansi) return res.status(400).json({ success: false, message: 'Nama instansi wajib diisi.' });

    try {
        const sql = `INSERT INTO instansi (nama_instansi) VALUES ($1) RETURNING id;`;
        const result = await db.query(sql, [namaInstansi]);
        res.status(201).json({ success: true, message: 'Instansi baru berhasil ditambahkan!', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ success: false, message: 'Nama instansi sudah terdaftar.' });
        res.status(500).json({ success: false, message: 'Error server: ' + err.message });
    }
};

exports.getAllInstansi = async (req, res) => {
    try {
        const result = await db.query('SELECT id, nama_instansi FROM instansi ORDER BY nama_instansi ASC;');
        res.status(200).json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};