// ==========================================
// HELPER SANITASI & VALIDASI INPUT
// ==========================================
// Dipakai di semua controller sebelum data disimpan ke database atau
// dikirim lewat email, untuk mencegah:
//  - XSS (Cross-Site Scripting) via judul/konten yang berisi <script>
//  - HTML/Header Injection pada email notifikasi
//  - Data "sampah" (whitespace, tipe data salah) masuk ke kolom DB
const sanitizeHtml = require('sanitize-html');
const bcrypt = require('bcryptjs');

// Untuk field yang TIDAK BOLEH mengandung tag HTML sama sekali
// (nama kategori, nama instansi, judul, nama user, slug, dsb).
function sanitizePlainText(input) {
  if (input === undefined || input === null) return input;
  return sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} }).trim();
}

// Untuk field "rich text" yang boleh mengandung tag HTML dasar
// (konten berita, isi pengumuman, deskripsi about, dll) — tag berbahaya
// seperti <script>, <iframe>, atau atribut onerror/onclick akan dibuang.
function sanitizeRichText(input) {
  if (input === undefined || input === null) return input;
  return sanitizeHtml(String(input), {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      span: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  }).trim();
}

// Untuk menyisipkan teks polos (judul, nama target, dsb) ke dalam HTML
// email tanpa risiko HTML/script injection dari pengirim.
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

// Memastikan link (mis. link_gform) benar-benar URL http/https yang valid,
// bukan skema berbahaya seperti javascript: atau data:
function isValidHttpUrl(str) {
  if (!str) return true; // kolom opsional, boleh kosong
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// (PENTING) Verifikasi password dengan dukungan migrasi bertahap dari
// password lama yang tersimpan plain text ke bcrypt, tanpa mengunci akun
// lama dan tanpa mengubah struktur tabel `users`.
async function verifyPassword(plainPassword, storedPassword) {
  const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword || '');
  if (isBcryptHash) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  // Fallback: akun lama yang password-nya belum di-hash.
  return plainPassword === storedPassword;
}

function isBcryptHash(storedPassword) {
  return /^\$2[aby]\$\d{2}\$/.test(storedPassword || '');
}

// Ubah teks bebas menjadi slug URL yang aman (huruf kecil, angka, "-")
function buatSlug(text) {
  return String(text).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

module.exports = {
  sanitizePlainText,
  sanitizeRichText,
  escapeHtml,
  isValidEmail,
  isValidHttpUrl,
  verifyPassword,
  isBcryptHash,
  buatSlug,
};
