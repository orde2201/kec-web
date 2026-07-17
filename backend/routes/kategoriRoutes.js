const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController');

router.post('/kategori-berita', kategoriController.addKategori);
router.get('/kategori-berita', kategoriController.getAllKategori);

module.exports = router;