// ==========================================
// CONTROLLER: PENGATURAN (HERO, ABOUT, LOGO & FOOTER)
// ==========================================
const pool = require('../config/db');
const { sanitizePlainText, sanitizeRichText, isValidEmail } = require('../utils/sanitize');

// GET Pengaturan Halaman
async function getPengaturan(req, res) {
  try {
    const query = 'SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1';
    const { rows } = await pool.query(query);
    res.json(rows.length > 0 ? rows[0] : {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST/PUT Update Pengaturan Halaman (dipakai untuk /api/pengaturan
// dan /api/pengaturan/update)
async function handlePengaturanUpdate(req, res) {
  try {
    // about_desc & footer_about boleh mengandung HTML dasar (rich text),
    // sisanya teks polos saja.
    const about_title = sanitizePlainText(req.body.about_title);
    const about_desc = sanitizeRichText(req.body.about_desc);
    const footer_about = sanitizeRichText(req.body.footer_about);
    const footer_address = sanitizePlainText(req.body.footer_address);
    const footer_phone = sanitizePlainText(req.body.footer_phone);
    const footer_email = req.body.footer_email ? sanitizePlainText(req.body.footer_email) : req.body.footer_email;
    const footer_copyright = sanitizePlainText(req.body.footer_copyright);

    if (footer_email && !isValidEmail(footer_email)) {
      return res.status(400).json({ success: false, message: 'Format footer_email tidak valid!' });
    }

    const currentRes = await pool.query('SELECT * FROM pengaturan_halaman ORDER BY id ASC LIMIT 1');
    const currentData = currentRes.rows[0];

    let hero_image = currentData ? currentData.hero_image : null;
    let about_image = currentData ? currentData.about_image : null;
    let logo = currentData ? currentData.logo : null;

    if (req.files && req.files['hero_image']) hero_image = req.files['hero_image'][0].filename;
    if (req.files && req.files['about_image']) about_image = req.files['about_image'][0].filename;
    if (req.files && req.files['logo']) logo = req.files['logo'][0].filename;

    if (currentData) {
      const updateQuery = `
        UPDATE pengaturan_halaman 
        SET hero_image = $1, 
            about_image = $2, 
            logo = $3, 
            about_title = $4, 
            about_desc = $5, 
            footer_about = $6, 
            footer_address = $7, 
            footer_phone = $8, 
            footer_email = $9, 
            footer_copyright = $10, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $11 RETURNING *
      `;
      const values = [
        hero_image, about_image, logo,
        about_title, about_desc,
        footer_about, footer_address, footer_phone, footer_email, footer_copyright,
        currentData.id
      ];
      const { rows } = await pool.query(updateQuery, values);
      res.json({ success: true, message: 'Pengaturan beranda & footer berhasil diupdate!', data: rows[0] });
    } else {
      const insertQuery = `
        INSERT INTO pengaturan_halaman 
        (hero_image, about_image, logo, about_title, about_desc, footer_about, footer_address, footer_phone, footer_email, footer_copyright) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
      `;
      const values = [
        hero_image, about_image, logo,
        about_title, about_desc,
        footer_about, footer_address, footer_phone, footer_email, footer_copyright
      ];
      const { rows } = await pool.query(insertQuery, values);
      res.json({ success: true, message: 'Pengaturan beranda & footer berhasil dibuat!', data: rows[0] });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getPengaturan, handlePengaturanUpdate };
