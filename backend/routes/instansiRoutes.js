const express = require('express');
const router = express.Router();
const instansiController = require('../controllers/instansiController');

router.get('/', instansiController.getInstansi);
router.post('/', instansiController.createInstansi);
router.delete('/:id', instansiController.deleteInstansi);

module.exports = router;
