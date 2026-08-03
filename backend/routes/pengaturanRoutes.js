const express = require('express');
const router = express.Router();
const pengaturanController = require('../controllers/pengaturanController');
const { upload } = require('../middleware/upload');

const pengaturanUpload = upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_image', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]);

router.get('/', pengaturanController.getPengaturan);
router.post('/', pengaturanUpload, pengaturanController.handlePengaturanUpdate);
router.post('/update', pengaturanUpload, pengaturanController.handlePengaturanUpdate);

module.exports = router;
