// ==========================================
// CONTROLLER: PENGUMUMAN (whatsapp-web.js)
// ==========================================
const pool = require('../config/db');
const waClient = require('../config/waClient'); // Import client WA lokal
const { sanitizePlainText, sanitizeRichText, isValidHttpUrl } = require('../utils/sanitize');

// Helper untuk format nomor HP ke ID WhatsApp Web (628xxx@c.us)
function formatNomorWA(noHp) {
  if (!noHp) return null;
  let clean = noHp.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return `${clean}@c.us`; // Format penulisan nomor unik di WhatsApp Web
}

// Helper Service Broadcast WhatsApp (Gratis via whatsapp-web.js)
async function kirimWaPengumuman({ id, judul, isi, link_gform, targetInstansiId }) {
  try {
    // Query menggunakan kolom 'phone' sesuai skema PostgreSQL
    let queryUser = `SELECT phone FROM users WHERE phone IS NOT NULL AND TRIM(phone) != ''`;
    let params = [];

    // Jika Target Instansi Spesifik (bukan 1 / publik)
    if (targetInstansiId && targetInstansiId != '1') {
      queryUser += ` AND instansi_id = $1`;
      params.push(targetInstansiId);
    }

    const { rows: userList } = await pool.query(queryUser, params);

    if (userList.length === 0) {
      console.log('Broadcast WA Dibatalkan: Tidak ada user dengan nomor HP untuk instansi ini.');
      return;
    }

    // 🌐 Buat Tautan Halaman Detail Pengumuman
    // Diambil dari environment variable (fallback ke localhost jika belum di-set)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4000/admin/html/detail-pengumuman.html';
    const linkDetail = `${baseUrl}?id=${id}`;

    // 💬 Format Pesan WhatsApp
    let pesanWA = `📢 *PENGUMUMAN RESMI*\n\n*${judul}*\n\n${isi}\n\n🔗 *Baca Selengkapnya:* ${linkDetail}`;

    if (link_gform) {
      pesanWA += `\n📌 *Link Form:* ${link_gform}`;
    }

    // Kirim pesan langsung dari WhatsApp Client lokal
    for (const u of userList) {
      const chatId = formatNomorWA(u.phone);
      if (chatId) {
        try {
          await waClient.sendMessage(chatId, pesanWA);
          console.log(`[WA BROADCAST] Pesan berhasil dikirim ke: ${u.phone}`);
        } catch (errWA) {
          console.error(`[WA BROADCAST ERROR] Gagal kirim ke ${u.phone}:`, errWA.message);
        }
      }
    }
  } catch (err) {
    console.error('Error pada Broadcast WA:', err.message);
  }
}

// GET Pengumuman
async function getPengumuman(req, res) {
  const { instansi_id } = req.query;
  try {
    let query = `SELECT p.*, i.nama_instansi FROM pengumuman p LEFT JOIN instansi i ON p.instansi_id = i.id`;
    let params = [];

    if (instansi_id === 'all') {
      query += ` ORDER BY p.created_at DESC`;
    } else if (instansi_id && instansi_id !== 'null' && instansi_id !== 'undefined' && instansi_id !== '') {
      query += ` WHERE p.instansi_id = $1 OR p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
      params.push(instansi_id);
    } else {
      query += ` WHERE p.instansi_id IS NULL OR p.instansi_id = 1 ORDER BY p.created_at DESC`;
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// GET Detail Pengumuman ID
async function getPengumumanById(req, res) {
  try {
    const result = await pool.query(`
      SELECT p.*, i.nama_instansi 
      FROM pengumuman p 
      LEFT JOIN instansi i ON p.instansi_id = i.id 
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// POST Tambah Pengumuman
async function createPengumuman(req, res) {
  const { instansi_id, kirim_wa } = req.body;
  const judul = sanitizePlainText(req.body.judul);
  const isi = sanitizeRichText(req.body.isi);
  const link_gform = req.body.link_gform ? req.body.link_gform.trim() : null;
  const gambar = req.file ? req.file.filename : null;

  if (!judul || !isi) {
    return res.status(400).json({ success: false, message: 'Judul dan isi pengumuman wajib diisi!' });
  }
  if (link_gform && !isValidHttpUrl(link_gform)) {
    return res.status(400).json({ success: false, message: 'Link Google Form / lampiran tidak valid!' });
  }

  try {
    const targetInstansi = (instansi_id == '1' || !instansi_id) ? null : instansi_id;
    const query = `
      INSERT INTO pengumuman (judul, isi, instansi_id, link_gform, gambar) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    const values = [judul, isi, targetInstansi, link_gform || null, gambar];
    const { rows } = await pool.query(query, values);
    const newPengumuman = rows[0];

    // JIKA CHECKBOX WA DICENTANG, JALANKAN BROADCAST WA
    if (kirim_wa === 'true' || kirim_wa === true) {
      kirimWaPengumuman({
        id: newPengumuman.id,
        judul: newPengumuman.judul,
        isi: newPengumuman.isi,
        link_gform: newPengumuman.link_gform,
        targetInstansiId: newPengumuman.instansi_id
      });
    }

    res.status(201).json({ success: true, message: 'Pengumuman berhasil diterbitkan!', data: newPengumuman });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// PUT Edit Pengumuman
async function updatePengumuman(req, res) {
  const { id } = req.params;
  const { instansi_id, kirim_wa } = req.body;
  const judul = req.body.judul !== undefined ? sanitizePlainText(req.body.judul) : undefined;
  const isi = req.body.isi !== undefined ? sanitizeRichText(req.body.isi) : undefined;
  const link_gform = req.body.link_gform !== undefined ? req.body.link_gform.trim() : undefined;

  if (link_gform && !isValidHttpUrl(link_gform)) {
    return res.status(400).json({ success: false, message: 'Link Google Form / lampiran tidak valid!' });
  }

  try {
    const oldRes = await pool.query('SELECT * FROM pengumuman WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' });
    }

    const oldData = oldRes.rows[0];
    const gambar = req.file ? req.file.filename : oldData.gambar;
    const targetInstansi = (instansi_id == '1' || !instansi_id) ? null : instansi_id;

    const updateQuery = `
      UPDATE pengumuman 
      SET judul = $1, isi = $2, instansi_id = $3, link_gform = $4, gambar = $5 
      WHERE id = $6 
      RETURNING *
    `;
    const values = [judul || oldData.judul, isi || oldData.isi, targetInstansi, link_gform || oldData.link_gform, gambar, id];
    const { rows } = await pool.query(updateQuery, values);
    const updatedPengumuman = rows[0];

    // JIKA CHECKBOX WA DICENTANG, JALANKAN BROADCAST WA
    if (kirim_wa === 'true' || kirim_wa === true) {
      kirimWaPengumuman({
        id: updatedPengumuman.id,
        judul: updatedPengumuman.judul,
        isi: updatedPengumuman.isi,
        link_gform: updatedPengumuman.link_gform,
        targetInstansiId: updatedPengumuman.instansi_id
      });
    }

    res.json({ success: true, message: 'Pengumuman berhasil diperbarui!', data: updatedPengumuman });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE Pengumuman
async function deletePengumuman(req, res) {
  try {
    await pool.query('DELETE FROM pengumuman WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Pengumuman berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Pastikan semua method di-export agar routes tidak melempar error `undefined`
module.exports = { 
  getPengumuman, 
  getPengumumanById, 
  createPengumuman, 
  updatePengumuman, 
  deletePengumuman 
};