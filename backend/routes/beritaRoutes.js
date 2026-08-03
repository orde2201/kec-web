const express = require('express');
const router = express.Router();
const beritaController = require('../controllers/beritaController');
const { upload } = require('../middleware/upload');

router.get('/', beritaController.getBerita);
router.get('/:id', beritaController.getBeritaById);
router.post('/', upload.array('gambar', 10), beritaController.createBerita);
router.put('/:id', upload.array('gambar', 10), beritaController.updateBerita);
router.delete('/:id', beritaController.deleteBerita);

module.exports = router;
