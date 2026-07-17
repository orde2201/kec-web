const express = require('express');
const router = express.Router();
const instansiController = require('../controllers/instansiController');

router.post('/instansi', instansiController.addInstansi);
router.get('/instansi', instansiController.getAllInstansi);

module.exports = router;