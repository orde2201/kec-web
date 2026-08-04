// ==========================================
// SERVICE: EMAIL NOTIFIKASI PENGUMUMAN
// ==========================================
const pool = require('../config/db');
const transporter = require('../config/mailer');
const { escapeHtml, isValidEmail, isValidHttpUrl } = require('../utils/sanitize');

// Kirim Email Notifikasi Pengumuman ke user (semua user atau per instansi)
async function kirimEmailPengumuman({ id, judul, isi, link_gform, targetInstansiId }) {
  try {
    let emailQuery = '';
    let queryParams = [];

    if (!targetInstansiId || targetInstansiId == '1') {
      emailQuery = `SELECT email FROM users WHERE email IS NOT NULL AND email != ''`;
    } else {
      emailQuery = `SELECT email FROM users WHERE instansi_id = $1 AND email IS NOT NULL AND email != ''`;
      queryParams.push(targetInstansiId);
    }

    const { rows } = await pool.query(emailQuery, queryParams);
    // Filter tambahan memastikan hanya format email yang valid yang dipakai
    // sebagai penerima (mencegah header injection lewat BCC).
    const emailList = rows.map(u => u.email).filter(e => isValidEmail(e));

    if (emailList.length === 0) {
      console.log('ℹ️ Tidak ada email user yang ditemukan untuk target instansi ini.');
      return;
    }

    let namaTarget = 'Everyone / Publik';
    if (targetInstansiId && targetInstansiId != '1') {
      const resInstansi = await pool.query('SELECT nama_instansi FROM instansi WHERE id = $1', [targetInstansiId]);
      if (resInstansi.rows.length > 0) {
        namaTarget = resInstansi.rows[0].nama_instansi;
      }
    }

    const frontendUrl = 'https://kec-rumbia.web.id';
    const linkPengumumanPortal = `${frontendUrl}/detail-pengumuman.html?id=${encodeURIComponent(id)}`;

    // judul & namaTarget di-escape karena teks polos yang disisipkan
    // langsung ke HTML email. `isi` sudah disanitasi rich-text sebelum
    // disimpan ke DB (lihat pengumumanController), sehingga aman
    // ditampilkan sebagai HTML di sini.
    const safeJudul = escapeHtml(judul);
    const safeNamaTarget = escapeHtml(namaTarget);
    const safeLink = escapeHtml(linkPengumumanPortal);
    const safeLinkGform = link_gform && isValidHttpUrl(link_gform) ? escapeHtml(link_gform) : null;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Portal Kecamatan Rumbia'}" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      bcc: emailList,
      subject: `[PENGUMUMAN - KEC RUMBIA untuk ${namaTarget}] ${judul}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <h2 style="color: #0d6efd; margin-top: 0;">${safeJudul}</h2>
          <p style="font-size: 13px; color: #6c757d;">Target Instansi: <strong>${safeNamaTarget}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
          
          <div style="font-size: 15px; margin-bottom: 20px; white-space: pre-line;">
            ${isi}
          </div>

          <div style="margin-top: 25px; text-align: center;">
            <a href="${safeLink}" target="_blank" style="background-color: #0d6efd; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px;">
              🌐 Baca Pengumuman di Portal
            </a>
          </div>

          ${safeLinkGform ? `
            <div style="margin-top: 12px; text-align: center;">
              <a href="${safeLinkGform}" target="_blank" style="background-color: #198754; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px;">
                📋 Buka Form Lampiran / Google Form
              </a>
            </div>
          ` : ''}

          <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0 15px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">
            Jika tombol tidak bisa diklik, salin link berikut ke browser Anda:<br>
            <a href="${safeLink}" style="color: #0d6efd;">${safeLink}</a>
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notifikasi email berhasil dikirim ke ${emailList.length} user. Message ID: ${info.messageId}`);
  } catch (err) {
    console.error('❌ Gagal mengirim email pengumuman:', err.message);
  }
}

module.exports = { kirimEmailPengumuman };
