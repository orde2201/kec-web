const express = require('express');
const router = express.Router();
const halamanController = require('../controllers/halamanController');
const { upload } = require('../middleware/upload');

router.get('/', halamanController.getHalaman);
router.get('/:slugOrId', halamanController.getHalamanDetail);
router.post('/', upload.single('gambar'), halamanController.createHalaman);
router.put('/:id', upload.single('gambar'), halamanController.updateHalaman);
router.delete('/:id', halamanController.deleteHalaman);

module.exports = router;
