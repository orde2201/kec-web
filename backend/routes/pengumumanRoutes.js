const express = require('express');
const router = express.Router();
const pengumumanController = require('../controllers/pengumumanController');
const { upload } = require('../middleware/upload');

router.get('/', pengumumanController.getPengumuman);
router.get('/:id', pengumumanController.getPengumumanById);
router.post('/', upload.single('gambar'), pengumumanController.createPengumuman);
router.put('/:id', upload.single('gambar'), pengumumanController.updatePengumuman);
router.delete('/:id', pengumumanController.deletePengumuman);

module.exports = router;