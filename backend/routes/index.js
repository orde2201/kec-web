// ==========================================
// ROUTER INDEX — GABUNGAN SEMUA ROUTE /api/...
// ==========================================
const express = require('express');
const router = express.Router();

router.use('/kategori', require('./kategoriRoutes'));
router.use('/instansi', require('./instansiRoutes'));
router.use('/berita', require('./beritaRoutes'));
router.use('/pengumuman', require('./pengumumanRoutes'));
router.use('/storage-stats', require('./storageRoutes'));
// usersRoutes berisi /users, /add-users, /login (tanpa prefix tambahan,
// supaya URL akhir sama persis dengan versi server.js sebelumnya)
router.use('/', require('./usersRoutes'));
router.use('/pengaturan', require('./pengaturanRoutes'));
router.use('/halaman', require('./halamanRoutes'));

module.exports = router;
