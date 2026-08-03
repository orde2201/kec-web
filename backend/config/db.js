// ==========================================
// KONFIGURASI KONEKSI DATABASE POSTGRESQL
// ==========================================
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'database',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// (PENTING) node-postgres akan MEMATIKAN seluruh proses Node.js jika idle
// client di dalam pool memunculkan event 'error' (mis. koneksi terputus
// sesaat) dan tidak ada yang menangani. Listener ini mencegah server
// crash mendadak akibat gangguan jaringan/database sesaat.
pool.on('error', (err) => {
  console.error('⚠️  Kesalahan tak terduga pada idle client PostgreSQL (server tetap berjalan):', err.message);
});

// Tes koneksi database saat aplikasi start
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database PostgreSQL:', err.stack);
    return;
  }
  console.log('✅ Terhubung ke database PostgreSQL');
  release();
});

module.exports = pool;
